import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import * as bcrypt from 'bcrypt';
import { TableManagerService } from '../table-engine/table-manager.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { GameStage } from '../table-engine/table';
import {
  ROOM_CREATED_EVENT,
  ROOM_DISSOLVED_EVENT,
  ROOM_STATUS_UPDATED_EVENT,
  RoomCreatedPayload,
  RoomDissolvedPayload,
  RoomStatusUpdatedPayload,
  roomEvents,
} from './room-events';
import {
  MatchmakingService,
  BlindTier,
  BLIND_TIERS,
} from '../matchmaking/matchmaking.service';
import { RedisService } from '../redis/redis.service';
import { BotService } from '../bot/bot.service';
import { WebSocketManager } from './websocket-manager';
import { FriendService } from '../friend/friend.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.WS_ALLOWED_ORIGINS?.split(',') ?? false)
        : '*',
    credentials: true,
  },
})
export class AppGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private static readonly DISCONNECT_GRACE_PERIOD_MS = 15000;
  private static readonly SETTLEMENT_DURATION_MS = 5000;
  private static readonly READY_COUNTDOWN_MS = 5000;
  private static readonly ACTION_DURATION_MS = 20000;
  private static readonly SOLO_READY_COUNTDOWN_MS = 10000;
  private static readonly RATE_LIMIT_WINDOW_MS = 1000; // 1-second sliding window
  private static readonly RATE_LIMIT_MAX_ACTIONS = 10; // max 10 messages per window per user

  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');
  private pendingDisconnects = new Map<string, NodeJS.Timeout>();
  private settlementTimers = new Map<string, NodeJS.Timeout>();
  private autoStartTimers = new Map<string, NodeJS.Timeout>();
  private actionTimers = new Map<string, NodeJS.Timeout>();
  /**
   * Per-room processing lock: chains async operations so that concurrent
   * socket events for the same room are serialized (Tick Loop lite).
   */
  private roomLocks = new Map<string, Promise<void>>();
  /**
   * Per-user processing lock: prevents the same account from executing
   * overlapping join/leave flows that can lead to multi-room membership.
   */
  private userLocks = new Map<string, Promise<void>>();
  /** Sliding-window rate limiter: userId -> { count, windowStart } */
  private rateLimits = new Map<string, { count: number; windowStart: number }>();


  constructor(
    private tableManager: TableManagerService,
    private jwtService: JwtService,
    private userService: UserService,
    private matchmakingService: MatchmakingService,
    private redisService: RedisService,
    private botService: BotService,
    private wsManager: WebSocketManager,
    @Inject(forwardRef(() => FriendService))
    private friendService: FriendService,
  ) {}

  /**
   * Notify all accepted friends of a user status change (online/offline)
   */
  private async notifyFriendsOfStatusChange(
    userId: string,
    online: boolean,
  ): Promise<void> {
    try {
      const friends = await this.friendService.getAcceptedFriends(userId);

      for (const friend of friends) {
        this.wsManager.emitToUser(friend.friendId, 'friend_status_update', {
          friendUserId: userId,
          friendNickname: friend.nickname,
          friendAvatar: friend.avatar,
          online,
        });
      }
    } catch (err) {
      this.logger.error('notifyFriendsOfStatusChange error', err);
    }
  }

  /**
   * Serialize all async operations for a given room through a promise chain.
   * This prevents race conditions when two clients send events simultaneously
   * for the same table (e.g. two players act at the exact same millisecond).
   */
  private withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const outer = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const prev = this.roomLocks.get(roomId) ?? Promise.resolve();
    const next = prev.then(() => fn()).then(resolve, reject);
    this.roomLocks.set(
      roomId,
      next.then(
        () => {},
        () => {},
      ),
    );
    return outer;
  }

  private withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const outer = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const prev = this.userLocks.get(userId) ?? Promise.resolve();
    const next = prev.then(() => fn()).then(resolve, reject);
    this.userLocks.set(
      userId,
      next.then(
        () => {},
        () => {},
      ),
    );
    return outer;
  }

  /**
   * Sliding-window rate limit check for WebSocket message throughput.
   * Returns true if the user is within the rate limit; emits a rate_limited
   * event and returns false if exceeded.
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(userId);
    const windowStart = entry?.windowStart ?? now;
    const count = entry?.count ?? 0;

    // Reset window if expired (>1s elapsed)
    if (now - windowStart > AppGateway.RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (count >= AppGateway.RATE_LIMIT_MAX_ACTIONS) {
      return false;
    }

    this.rateLimits.set(userId, { count: count + 1, windowStart });
    return true;
  }

  private handleRoomCreated = (room: RoomCreatedPayload) => {
    if (!this.server) {
      this.logger.warn('room_created skipped: websocket server not ready');
      return;
    }
    this.server.emit('room_created', room);
  };

  private handleRoomDissolved = (payload: RoomDissolvedPayload) => {
    if (!this.server) {
      this.logger.warn('room_dissolved skipped: websocket server not ready');
      return;
    }
    this.server.emit('room_dissolved', { id: payload.id });
  };

  private handleRoomStatusUpdated = (payload: RoomStatusUpdatedPayload) => {
    if (!this.server) {
      this.logger.warn('room_status_updated skipped: websocket server not ready');
      return;
    }
    this.server.emit('room_status_updated', payload);
  };

  onModuleInit() {
    roomEvents.on(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.on(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
    roomEvents.on(ROOM_STATUS_UPDATED_EVENT, this.handleRoomStatusUpdated);
  }

  onModuleDestroy() {
    roomEvents.off(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.off(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
    roomEvents.off(ROOM_STATUS_UPDATED_EVENT, this.handleRoomStatusUpdated);
    for (const timeout of this.pendingDisconnects.values()) {
      clearTimeout(timeout);
    }
    this.pendingDisconnects.clear();
    for (const timeout of this.settlementTimers.values()) {
      clearTimeout(timeout);
    }
    this.settlementTimers.clear();
    for (const timeout of this.autoStartTimers.values()) {
      clearTimeout(timeout);
    }
    this.autoStartTimers.clear();
    for (const timeout of this.actionTimers.values()) {
      clearTimeout(timeout);
    }
    this.actionTimers.clear();
  }

  /** Broadcast masked table state to every socket in the room individually.
   * Optimized: group sockets by userId so getMaskedView() is only called once per user.
   * This matters when one user has multiple open sockets (multi-device).
   */
  private async broadcastTableState(
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    const sockets = await this.server.in(roomId).fetchSockets();

    // Group sockets by userId so we compute masked view once per user
    const socketsByUser = new Map<string | undefined, typeof sockets>();
    for (const socket of sockets) {
      const userId = socket.data.user?.sub as string | undefined;
      const list = socketsByUser.get(userId) ?? [];
      list.push(socket);
      socketsByUser.set(userId, list);
    }

    for (const [userId, userSockets] of socketsByUser) {
      const view = userId ? table.getMaskedView(userId) : table.getMaskedView('');
      for (const socket of userSockets) {
        socket.emit('room_update', view);
      }
    }
  }

  private async syncRoomAfterPlayerExit(roomId: string, dissolved: boolean) {
    if (dissolved) {
      this.clearRoundTimers(roomId);
      return;
    }

    const table = await this.tableManager.getTable(roomId);
    if (table) {
      await this.broadcastTableState(roomId, table);
    }
  }

  private async hasOtherActiveSocket(userId: string, socketId: string) {
    const sockets = await this.server.fetchSockets();
    return sockets.some(
      (socket) =>
        socket.id !== socketId &&
        (socket.data.user?.sub as string | undefined) === userId,
    );
  }

  private clearPendingDisconnect(userId: string) {
    const timeout = this.pendingDisconnects.get(userId);
    if (!timeout) {
      return;
    }

    clearTimeout(timeout);
    this.pendingDisconnects.delete(userId);
  }

  private clearRoundTimers(roomId: string) {
    const actionTimer = this.actionTimers.get(roomId);
    if (actionTimer) {
      clearTimeout(actionTimer);
      this.actionTimers.delete(roomId);
    }

    const settlementTimer = this.settlementTimers.get(roomId);
    if (settlementTimer) {
      clearTimeout(settlementTimer);
      this.settlementTimers.delete(roomId);
    }

    const autoStartTimer = this.autoStartTimers.get(roomId);
    if (autoStartTimer) {
      clearTimeout(autoStartTimer);
      this.autoStartTimers.delete(roomId);
    }
  }

  private isActionStage(stage: GameStage) {
    return (
      stage === GameStage.PREFLOP ||
      stage === GameStage.FLOP ||
      stage === GameStage.TURN ||
      stage === GameStage.RIVER
    );
  }

  private async finalizeActionTimeout(roomId: string) {
    this.actionTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || !this.isActionStage(currentTable.currentStage)) {
      return;
    }

    // SITOUT players must be auto-folded when their action times out.
    // getTimeoutAction() returns null for non-ACTIVE players, so we must
    // check sit-out status BEFORE calling getTimeoutAction().
    if (currentTable.isCurrentPlayerSitOut()) {
      const processed = currentTable.foldSitOutPlayer();
      if (!processed) {
        if (this.isActionStage(currentTable.currentStage)) {
          await this.scheduleActionTimeout(roomId, currentTable);
        }
        return;
      }
      const nextStage = currentTable.currentStage as GameStage;
      await this.tableManager.persistTableState(roomId);
      await this.tableManager.persistTableBalances(roomId);
      if (nextStage === GameStage.SETTLEMENT) {
        await this.schedulePostHandFlow(roomId, currentTable);
      } else if (this.isActionStage(nextStage)) {
        await this.scheduleActionTimeout(roomId, currentTable);
      }
      await this.broadcastTableState(roomId, currentTable);
      return;
    }

    const timeoutAction = currentTable.getTimeoutAction();
    if (!timeoutAction) {
      return;
    }

    let processed = false;

    if (timeoutAction.action === 'sitout') {
      // SITOUT players are folded via foldSitOutPlayer which also handles
      // fold-win (single remaining player).
      processed = currentTable.foldSitOutPlayer();
    } else {
      processed = currentTable.processAction(
        timeoutAction.playerId,
        timeoutAction.action,
        0,
      );
    }

    if (!processed) {
      if (this.isActionStage(currentTable.currentStage)) {
        await this.scheduleActionTimeout(roomId, currentTable);
      }
      return;
    }

    const nextStage = currentTable.currentStage as GameStage;
    await this.tableManager.persistTableState(roomId);
    await this.tableManager.persistTableBalances(roomId);
    if (nextStage === GameStage.SETTLEMENT) {
      await this.schedulePostHandFlow(roomId, currentTable);
      await this.broadcastTableState(roomId, currentTable);
      return;
    }
    if (this.isActionStage(nextStage)) {
      await this.scheduleActionTimeout(roomId, currentTable);
    }

    await this.broadcastTableState(roomId, currentTable);
  }

  private async scheduleActionTimeout(
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = AppGateway.ACTION_DURATION_MS,
    reuseExistingCountdown = false,
  ) {
    const existing = this.actionTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    if (!this.isActionStage(table.currentStage)) {
      table.clearActionCountdown();
      this.actionTimers.delete(roomId);
      return;
    }

    if (!reuseExistingCountdown) {
      table.beginActionCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(() => {
      void this.finalizeActionTimeout(roomId);
    }, durationMs);

    this.actionTimers.set(roomId, timer);
  }

  private async finalizeReadyCountdown(roomId: string) {
    this.autoStartTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || currentTable.currentStage !== GameStage.WAITING) {
      return;
    }

    currentTable.clearReadyCountdown();
    currentTable.startHandIfReady();
    await this.tableManager.persistTableBalances(roomId);
    if (this.isActionStage(currentTable.currentStage)) {
      await this.scheduleActionTimeout(roomId, currentTable);
    } else {
      await this.tableManager.persistTableState(roomId);
    }
    await this.broadcastTableState(roomId, currentTable);
  }

  private async scheduleAutoStart(
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = AppGateway.READY_COUNTDOWN_MS,
    reuseExistingCountdown = false,
  ) {
    const existing = this.autoStartTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    if (!reuseExistingCountdown) {
      table.beginReadyCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(() => {
      void this.finalizeReadyCountdown(roomId);
    }, durationMs);

    this.autoStartTimers.set(roomId, timer);
  }

  private async finalizeSettlement(roomId: string) {
    this.settlementTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || currentTable.currentStage !== GameStage.SETTLEMENT) {
      return;
    }

    // Capture hand result before it's cleared by persistSettlementRecords / resetToWaiting
    const handResult = currentTable.lastHandResult
      ? [...currentTable.lastHandResult]
      : [];

    // Persist settlement records BEFORE resetToWaiting clears lastHandResult
    await this.tableManager.persistSettlementRecords(roomId);

    // Update ELO ratings for all participants
    if (handResult.length > 0) {
      this.matchmakingService.updateElo(handResult).catch((err) => {
        this.logger.error(`ELO update failed for room ${roomId}`, err);
      });
    }

    currentTable.resetToWaiting();
    await this.tableManager.persistTableState(roomId);
    await this.tableManager.persistTableBalances(roomId);
    await this.scheduleAutoStart(roomId, currentTable);
    await this.broadcastTableState(roomId, currentTable);
  }

  private async schedulePostHandFlow(
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = AppGateway.SETTLEMENT_DURATION_MS,
    reuseExistingCountdown = false,
  ) {
    this.clearRoundTimers(roomId);
    if (!reuseExistingCountdown) {
      table.beginSettlementCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(() => {
      void this.finalizeSettlement(roomId);
    }, durationMs);

    this.settlementTimers.set(roomId, timer);
  }

  private async ensureRecoveredRoundFlow(
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    if (this.isActionStage(table.currentStage)) {
      if (!table.actionEndsAt) {
        if (!this.actionTimers.has(roomId)) {
          await this.scheduleActionTimeout(roomId, table);
        }
        return;
      }

      const remainingMs = table.actionEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeActionTimeout(roomId);
        return;
      }

      if (!this.actionTimers.has(roomId)) {
        await this.scheduleActionTimeout(roomId, table, remainingMs, true);
      }
      return;
    }

    if (table.currentStage === GameStage.SETTLEMENT && table.settlementEndsAt) {
      const remainingMs = table.settlementEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeSettlement(roomId);
        return;
      }

      if (!this.settlementTimers.has(roomId)) {
        await this.schedulePostHandFlow(roomId, table, remainingMs, true);
      }
      return;
    }

    if (
      table.currentStage === GameStage.WAITING &&
      table.readyCountdownEndsAt
    ) {
      const remainingMs = table.readyCountdownEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeReadyCountdown(roomId);
        return;
      }

      if (!this.autoStartTimers.has(roomId)) {
        await this.scheduleAutoStart(roomId, table, remainingMs, true);
      }
    }
  }

  private scheduleDisconnectCleanup(userId: string) {
    this.clearPendingDisconnect(userId);

    const timeout = setTimeout(async () => {
      this.pendingDisconnects.delete(userId);

      if (await this.hasOtherActiveSocket(userId, '')) {
        return;
      }

      const roomId = await this.tableManager.getUserCurrentRoomId(userId);
      if (!roomId) return;

      await this.withRoomLock(roomId, async () => {
        const result = await this.tableManager.leaveCurrentRoom(userId);
        if (!result) return;

        if (result.dissolved) {
          this.clearRoundTimers(roomId);
        } else if (result.reachedSettlement) {
          const table = await this.tableManager.getTable(roomId);
          if (table) {
            await this.schedulePostHandFlow(roomId, table);
            await this.broadcastTableState(roomId, table);
          }
        } else {
          const table = await this.tableManager.getTable(roomId);
          if (table) {
            if (this.isActionStage(table.currentStage)) {
              await this.scheduleActionTimeout(roomId, table);
            }
            await this.broadcastTableState(roomId, table);
          }
        }
      });
    }, AppGateway.DISCONNECT_GRACE_PERIOD_MS);

    this.pendingDisconnects.set(userId, timeout);
  }

  afterInit(server: Server) {
    this.wsManager.setServer(server);
    this.logger.log('Init');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);

      // Set user data immediately — handleConnection is async, and the client can
      // emit events (e.g. join_room) before the awaits below complete.
      client.data.user = payload;

      // Enforce single-device login: validate sessionId against Redis
      if (payload.sessionId && this.redisService.isAvailable) {
        const stored = await this.redisService.get(
          `user_session:${payload.sub}`,
        );
        if (stored !== payload.sessionId) {
          client.data.user = null;
          client.emit('force_logout', { reason: 'SESSION_REPLACED' });
          client.disconnect();
          return;
        }
      }

      this.clearPendingDisconnect(payload.sub);

      // Notify new client if they have an active game to rejoin
      const currentRoomId = await this.tableManager.getUserCurrentRoomId(
        payload.sub,
      );
      let isInActiveGame = false;
      if (currentRoomId) {
        const table = await this.tableManager.getTable(currentRoomId);
        if (
          table &&
          table.hasPlayer(payload.sub) &&
          table.currentStage !== GameStage.WAITING
        ) {
          isInActiveGame = true;
          client.emit('rejoin_available', { roomId: currentRoomId });
        }
      }

      // Disconnect any other sockets belonging to the same user (single-device enforcement)
      const allSockets = await this.server.fetchSockets();
      for (const other of allSockets) {
        if (
          other.id !== client.id &&
          (other.data.user?.sub as string | undefined) === payload.sub
        ) {
          other.emit('force_logout', {
            reason: 'SESSION_REPLACED',
            roomId: isInActiveGame ? currentRoomId : undefined,
          });
          other.disconnect();
        }
      }

      this.logger.log(
        `Client connected: ${client.id} User: ${payload.username}`,
      );

      // Push friend_status_update (online=true) to all accepted friends
      void this.notifyFriendsOfStatusChange(payload.sub, true);
    } catch (e) {
      this.logger.warn(
        `Connection rejected: invalid token from ${client.handshake.address}: ${(e as Error).message}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const userId = client.data.user?.sub as string | undefined;
    if (!userId) {
      return;
    }

    // Only notify friends if this is the user's last active socket
    if (!(await this.hasOtherActiveSocket(userId, client.id))) {
      void this.notifyFriendsOfStatusChange(userId, false);
    }

    const currentRoomId = await this.tableManager.getUserCurrentRoomId(userId);
    if (!currentRoomId) {
      return;
    }

    if (await this.hasOtherActiveSocket(userId, client.id)) {
      return;
    }

    this.scheduleDisconnectCleanup(userId);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; password?: string },
  ) {
    const { roomId, password } = data;
    const userId = client.data.user?.sub as string;

    // Rate limit join attempts to prevent room enumeration
    if (!this.checkRateLimit(userId)) {
      client.emit('rate_limited', { message: 'Too many join attempts, please slow down' });
      return;
    }

    return this.withUserLock(userId, async () => {
      const currentRoomId = await this.tableManager.getUserCurrentRoomId(userId);
      if (currentRoomId && currentRoomId !== roomId) {
        client.emit('already_in_room', {
          roomId: currentRoomId,
          targetRoomId: roomId,
          canSwitch: true,
        });
        return {
          event: 'already_in_room',
          data: { roomId: currentRoomId, targetRoomId: roomId, canSwitch: true },
        };
      }

      return this.withRoomLock(roomId, async () => {
        const verifiedCurrentRoomId = await this.tableManager.getUserCurrentRoomId(userId);
        if (verifiedCurrentRoomId && verifiedCurrentRoomId !== roomId) {
          client.emit('already_in_room', {
            roomId: verifiedCurrentRoomId,
            targetRoomId: roomId,
            canSwitch: true,
          });
          return {
            event: 'already_in_room',
            data: {
              roomId: verifiedCurrentRoomId,
              targetRoomId: roomId,
              canSwitch: true,
            },
          };
        }

        const table = await this.tableManager.getTable(roomId);
        if (!table) {
          return { event: 'error', data: 'Room not found' };
        }

        // Password check for private rooms (skip if already seated — reconnect)
        const isAlreadySeated = table.hasPlayer(userId);
        if (!isAlreadySeated && table.roomPassword) {
          const passwordMatch = await bcrypt.compare(
            password ?? '',
            table.roomPassword,
          );
          if (!passwordMatch) {
            client.emit('wrong_password', { roomId });
            return { event: 'wrong_password', data: { roomId } };
          }
        }

        await this.ensureRecoveredRoundFlow(roomId, table);
        const balance = isAlreadySeated
          ? null
          : await this.tableManager.getUserAvailableBalance(userId);
        const minimumRequiredBalance = table.minBuyIn;
        if (!isAlreadySeated && (balance ?? 0) < minimumRequiredBalance) {
          client.emit('insufficient_balance', {
            roomId,
            balance: balance ?? 0,
            minimumRequiredBalance,
          });
          return {
            event: 'insufficient_balance',
            data: {
              roomId,
              balance: balance ?? 0,
              minimumRequiredBalance,
            },
          };
        }

        // Avoid duplicate seat in same room; reject if room is full
        // Fetch latest avatar from DB so it's always up-to-date
        const avatar = await this.userService.getUserAvatar(userId);
        const playerData = { ...client.data.user, avatar: avatar ?? '' };

        const joined = table.addPlayer(playerData, balance ?? 0);
        if (!joined) {
          client.emit('room_full', { roomId });
          return {
            event: 'room_full',
            data: { roomId },
          };
        }

        // Freeze entire balance while player is seated
        if (!isAlreadySeated && balance !== null) {
          await this.tableManager.freezePlayerBalance(userId, balance);
        }

        client.join(roomId);
        await this.tableManager.persistTableState(roomId);
        await this.broadcastTableState(roomId, table);
        await this.tableManager.broadcastRoomStatus(roomId);
        return {
          event: 'joined',
          data: table.getMaskedView(client.data.user?.sub),
        };
      });
    });
  }

  @SubscribeMessage('player_ready')
  async handlePlayerReady(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string;
    const roomId = await this.tableManager.getUserCurrentRoomId(userId);
    if (!roomId) {
      return { event: 'error', data: 'Not in any room' };
    }

    return this.withRoomLock(roomId, async () => {
      const table = await this.tableManager.getTable(roomId);
      if (!table) {
        return { event: 'error', data: 'Room not found' };
      }

      await this.ensureRecoveredRoundFlow(roomId, table);

      const allReady = table.setPlayerReady(userId);

      if (table.readyCountdownEndsAt) {
        await this.tableManager.persistTableState(roomId);
        await this.broadcastTableState(roomId, table);
        return { event: 'ready_updated', data: { roomId } };
      }

      if (allReady) {
        table.startHandIfReady();
        await this.tableManager.persistTableBalances(roomId);
        if (this.isActionStage(table.currentStage)) {
          await this.scheduleActionTimeout(roomId, table);
        }
      } else {
        // Not all ready yet — start auto-start countdown
        const playable = table.players.filter((p) => p && p.stack > 0);
        if (playable.length === 1 && playable[0]!.ready && playable[0]!.id === userId) {
          await this.scheduleAutoStart(roomId, table, AppGateway.SOLO_READY_COUNTDOWN_MS);
        }
      }

      await this.tableManager.persistTableState(roomId);
      await this.broadcastTableState(roomId, table);
      return { event: 'ready_updated', data: { roomId } };
    });
  }

  private static readonly VALID_ACTIONS = new Set([
    'fold',
    'check',
    'call',
    'raise',
    'allin',
    'straddle',
    'sit-out',
  ]);

  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { action: unknown; amount?: unknown; roomId?: unknown },
  ) {
    const userId = client.data.user?.sub as string | undefined;
    if (!userId) return;

    // ── Input validation ────────────────────────────────────────────────
    const action =
      typeof data?.action === 'string' &&
      AppGateway.VALID_ACTIONS.has(data.action)
        ? data.action
        : null;
    const amount =
      typeof data?.amount === 'number' && isFinite(data.amount) && data.amount >= 0
        ? data.amount
        : 0;
    const roomId = typeof data?.roomId === 'string' ? data.roomId : null;

    if (!action || !roomId) {
      client.emit('error', { message: 'Invalid action or roomId' });
      return;
    }

    // Rate limit check
    if (!this.checkRateLimit(userId)) {
      client.emit('rate_limited', { message: 'Too many actions, please slow down' });
      return;
    }

    return this.withRoomLock(roomId, async () => {
      const table = await this.tableManager.getTable(roomId);
      if (!table) return;

      await this.ensureRecoveredRoundFlow(roomId, table);
      const processed = table.processAction(userId, action, amount);
      if (!processed) {
        return;
      }

      await this.tableManager.persistTableState(roomId);
      await this.tableManager.persistTableBalances(roomId);
      if (table.currentStage === GameStage.SETTLEMENT) {
        await this.schedulePostHandFlow(roomId, table);
      } else if (this.isActionStage(table.currentStage)) {
        await this.scheduleActionTimeout(roomId, table);
      }

      await this.broadcastTableState(roomId, table);
    });
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string;
    this.clearPendingDisconnect(userId);

    return this.withUserLock(userId, async () => {
      const roomId = await this.tableManager.getUserCurrentRoomId(userId);
      if (!roomId) {
        return { event: 'error', data: 'Not in any room' };
      }

      return this.withRoomLock(roomId, async () => {
        const result = await this.tableManager.leaveCurrentRoom(userId);
        if (!result) {
          return { event: 'error', data: 'Not in any room' };
        }

        this.matchmakingService.recordPlayerLeft(roomId, userId);
        client.leave(roomId);

        if (result.dissolved) {
          this.clearRoundTimers(roomId);
        } else if (result.reachedSettlement) {
          const table = await this.tableManager.getTable(roomId);
          if (table) {
            await this.schedulePostHandFlow(roomId, table);
            await this.broadcastTableState(roomId, table);
          }
        } else {
          const table = await this.tableManager.getTable(roomId);
          if (table) {
            if (this.isActionStage(table.currentStage)) {
              await this.scheduleActionTimeout(roomId, table);
            }
            await this.broadcastTableState(roomId, table);
          }
        }

        client.emit('left_room', { roomId, dissolved: result.dissolved });
        return {
          event: 'left_room',
          data: { roomId, dissolved: result.dissolved },
        };
      });
    });
  }

  /**
   * Quick-match: find or create a suitable matchmaking room for the requested tier,
   * then emit match_found so the client can navigate to the room.
   */
  @SubscribeMessage('quick_match')
  async handleQuickMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tier: BlindTier },
  ) {
    const userId = client.data.user?.sub as string;
    if (!userId) return { event: 'error', data: 'Unauthorized' };

    const tier = data?.tier;
    if (!tier || !BLIND_TIERS[tier]) {
      client.emit('match_error', { message: 'Invalid tier' });
      return;
    }

    const config = BLIND_TIERS[tier];

    // Ensure player isn't already in a room
    const currentRoomId = await this.tableManager.getUserCurrentRoomId(userId);
    if (currentRoomId) {
      client.emit('match_error', {
        message: 'already_in_room',
        roomId: currentRoomId,
      });
      return;
    }

    // Validate available chips
    const availableChips =
      await this.tableManager.getUserAvailableBalance(userId);
    if (availableChips < config.minBuyIn) {
      client.emit('match_error', {
        message: 'insufficient_chips',
        required: config.minBuyIn,
      });
      return;
    }

    const playerElo = await this.matchmakingService.getPlayerElo(userId);
    const rawIp = client.handshake.address ?? '0.0.0.0';
    const ipHash = this.matchmakingService.hashIp(rawIp);

    try {
      const roomId = await this.matchmakingService.findOrCreateMatchmakingRoom(
        userId,
        tier,
        playerElo,
        ipHash,
      );

      // Record this player in the matchmaking tracking maps before they officially join
      this.matchmakingService.recordPlayerJoined(
        roomId,
        userId,
        playerElo,
        ipHash,
      );

      client.emit('match_found', { roomId, tier });
    } catch (err) {
      this.logger.error('quick_match error', err);
      client.emit('match_error', { message: 'server_error' });
    }
  }

  @SubscribeMessage('show_cards')
  async handleShowCards(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string;
    if (!userId) return;

    const roomId = await this.tableManager.getUserCurrentRoomId(userId);
    if (!roomId) return;

    const table = await this.tableManager.getTable(roomId);
    if (!table) return;

    if (table.currentStage !== GameStage.SETTLEMENT || !table.isFoldWin) return;

    const isWinner =
      table.lastHandResult?.some(
        (e) => e.playerId === userId && e.winAmount > 0,
      ) ?? false;
    if (!isWinner) return;

    table.revealFoldWinnerCards();
    await this.tableManager.persistTableState(roomId);
    await this.broadcastTableState(roomId, table);
  }

  /**
   * Solo mode bot fill: add bots to reach at least 2 playable players.
   * Bots are added with ready=true so the table can start the hand.
   */
}
