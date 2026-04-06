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
import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Socket, Server } from 'socket.io';
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
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { RedisService } from '../redis/redis.service';
import { BotService } from '../bot/bot.service';
import { WebSocketManager } from './websocket-manager';
import { FriendService } from '../friend/friend.service';
import { getAllowedOrigins } from '../config/jwt.config';
import {
  handleJoinRoom,
  handlePlayerReady,
  handlePlayerAction,
  handleLeaveRoom,
  handleQuickMatch,
  handleShowCards,
} from './game.handler';
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_ACTIONS,
} from './constants';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
  // Socket.IO application-level heartbeat
  // Server sends ping every 25s, client must pong within 10s
  pingInterval: 25_000,
  pingTimeout: 10_000,
})
export class AppGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  // ── Constants ────────────────────────────────────────────────────────────
  // Gateway-only constants
  static readonly DISCONNECT_GRACE_PERIOD_MS = 15_000;
  static readonly SETTLEMENT_DURATION_MS = 5_000;
  static readonly READY_COUNTDOWN_MS = 5_000;
  static readonly ACTION_DURATION_MS = 20_000;
  // NOTE: SOLO_READY_COUNTDOWN_MS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ACTIONS
  // are defined in ./constants.ts and imported directly by game.handler.ts.
  // They are NOT exposed as AppGateway static properties (no external usage found).

  // ── WebSocket server ────────────────────────────────────────────────────
  @WebSocketServer() server: Server;

  // ── Logger (public so handlers can use it) ──────────────────────────────
  readonly logger: Logger = new Logger('AppGateway');

  // ── Timer maps ─────────────────────────────────────────────────────────
  private pendingDisconnects = new Map<string, NodeJS.Timeout>();
  private settlementTimers = new Map<string, NodeJS.Timeout>();
  private autoStartTimers = new Map<string, NodeJS.Timeout>();
  private actionTimers = new Map<string, NodeJS.Timeout>();

  // ── Concurrency locks ──────────────────────────────────────────────────
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

  // ── Rate limiter (public so handlers can check it) ────────────────────
  rateLimits = new Map<string, { count: number; windowStart: number }>();

  /**
   * Redis-backed rate limit check with in-memory Map fallback.
   * Redis key: ws_rate:{userId} — TTL = RATE_LIMIT_WINDOW_MS in seconds
   * Falls back to in-memory Map if Redis is unavailable.
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const windowSec = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    const count = await this.redisService.incr(
      `ws_rate:${userId}`,
      windowSec,
    );

    if (count !== null) {
      return count <= RATE_LIMIT_MAX_ACTIONS;
    }

    // Redis unavailable — fall back to in-memory Map (original behaviour)
    const now = Date.now();
    const entry = this.rateLimits.get(userId);
    const windowStart = entry?.windowStart ?? now;
    const cnt = entry?.count ?? 0;

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (cnt >= RATE_LIMIT_MAX_ACTIONS) {
      return false;
    }

    this.rateLimits.set(userId, { count: cnt + 1, windowStart });
    return true;
  }

  // ── Injected services ───────────────────────────────────────────────────
  constructor(
    readonly tableManager: TableManagerService,
    readonly jwtService: JwtService,
    readonly userService: UserService,
    readonly matchmakingService: MatchmakingService,
    readonly redisService: RedisService,
    readonly botService: BotService,
    private wsManager: WebSocketManager,
    @Inject(forwardRef(() => FriendService))
    readonly friendService: FriendService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // Lifecycle methods
  // ════════════════════════════════════════════════════════════════════════

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
      return;
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

  onModuleInit() {
    roomEvents.on(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.on(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
    roomEvents.on(ROOM_STATUS_UPDATED_EVENT, this.handleRoomStatusUpdated);
  }

  onModuleDestroy() {
    roomEvents.off(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.off(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
    roomEvents.off(ROOM_STATUS_UPDATED_EVENT, this.handleRoomStatusUpdated);
    for (const timeout of this.pendingDisconnects.values())
      clearTimeout(timeout);
    this.pendingDisconnects.clear();
    for (const timeout of this.settlementTimers.values()) clearTimeout(timeout);
    this.settlementTimers.clear();
    for (const timeout of this.autoStartTimers.values()) clearTimeout(timeout);
    this.autoStartTimers.clear();
    for (const timeout of this.actionTimers.values()) clearTimeout(timeout);
    this.actionTimers.clear();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Room event listeners (emitted to all connected clients)
  // ════════════════════════════════════════════════════════════════════════

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
      this.logger.warn(
        'room_status_updated skipped: websocket server not ready',
      );
      return;
    }
    this.server.emit('room_status_updated', payload);
  };

  // ════════════════════════════════════════════════════════════════════════
  // Friend status notification
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Notify all accepted friends of a user status change (online/offline)
   */
  private async notifyFriendsOfStatusChange(
    userId: string,
    online: boolean,
  ): Promise<void> {
    try {
      const friends = await this.friendService.getAcceptedFriends(userId);
      await Promise.all(
        friends.map((friend) =>
          this.wsManager.emitToUser(friend.friendId, 'friend_status_update', {
            friendUserId: userId,
            friendNickname: friend.nickname,
            friendAvatar: friend.avatar,
            online,
          }),
        ),
      );
    } catch (err) {
      this.logger.error('notifyFriendsOfStatusChange error', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Concurrency primitives
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Serialize all async operations for a given room through a promise chain.
   * This prevents race conditions when two clients send events simultaneously
   * for the same table (e.g. two players act at the exact same millisecond).
   */
  withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const outer = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const prev = this.roomLocks.get(roomId) ?? Promise.resolve();
    const next = prev.then(() => fn()).then(resolve, reject);
    next.finally(() => this.roomLocks.delete(roomId));
    this.roomLocks.set(
      roomId,
      next.then(
        () => {},
        () => {},
      ),
    );
    return outer;
  }

  withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const outer = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const prev = this.userLocks.get(userId) ?? Promise.resolve();
    const next = prev.then(() => fn()).then(resolve, reject);
    next.finally(() => this.userLocks.delete(userId));
    this.userLocks.set(
      userId,
      next.then(
        () => {},
        () => {},
      ),
    );
    return outer;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Table state broadcasting
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Broadcast masked table state to every socket in the room individually.
   * Optimized: group sockets by userId so getMaskedView() is only called once per user.
   * This matters when one user has multiple open sockets (multi-device).
   */
  async broadcastTableState(
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
      const view = userId
        ? table.getMaskedView(userId)
        : table.getMaskedView('');
      for (const socket of userSockets) {
        socket.emit('room_update', view);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Disconnect handling
  // ════════════════════════════════════════════════════════════════════════

  private async hasOtherActiveSocket(userId: string, socketId: string) {
    const sockets = await this.server.fetchSockets();
    return sockets.some(
      (socket) =>
        socket.id !== socketId &&
        (socket.data.user?.sub as string | undefined) === userId,
    );
  }

  clearPendingDisconnect(userId: string) {
    const timeout = this.pendingDisconnects.get(userId);
    if (!timeout) return;
    clearTimeout(timeout);
    this.pendingDisconnects.delete(userId);
  }

  scheduleDisconnectCleanup(userId: string) {
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

  // ════════════════════════════════════════════════════════════════════════
  // Round timers
  // ════════════════════════════════════════════════════════════════════════

  clearRoundTimers(roomId: string) {
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

  isActionStage(stage: GameStage) {
    return (
      stage === GameStage.PREFLOP ||
      stage === GameStage.FLOP ||
      stage === GameStage.TURN ||
      stage === GameStage.RIVER
    );
  }

  // ── Action timeout ─────────────────────────────────────────────────────

  async finalizeActionTimeout(roomId: string) {
    this.actionTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || !this.isActionStage(currentTable.currentStage)) {
      return;
    }

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

  async scheduleActionTimeout(
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

  // ── Ready countdown ────────────────────────────────────────────────────

  async finalizeReadyCountdown(roomId: string) {
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

  async scheduleAutoStart(
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

  // ── Settlement ─────────────────────────────────────────────────────────

  async finalizeSettlement(roomId: string) {
    this.settlementTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || currentTable.currentStage !== GameStage.SETTLEMENT) {
      return;
    }

    const handResult = currentTable.lastHandResult
      ? [...currentTable.lastHandResult]
      : [];

    await this.tableManager.persistSettlementRecords(roomId);

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

  async schedulePostHandFlow(
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

  // ── Recovery ───────────────────────────────────────────────────────────

  async ensureRecoveredRoundFlow(
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

  // ════════════════════════════════════════════════════════════════════════
  // @SubscribeMessage handlers (delegated to handler modules)
  // ════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; password?: string },
  ) {
    return handleJoinRoom(this, client, data);
  }

  @SubscribeMessage('player_ready')
  async handlePlayerReady(@ConnectedSocket() client: Socket) {
    return handlePlayerReady(this, client);
  }

  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { action: unknown; amount?: unknown; roomId?: unknown },
  ) {
    return handlePlayerAction(this, client, data);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    return handleLeaveRoom(this, client);
  }

  @SubscribeMessage('quick_match')
  async handleQuickMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { tier: import('../matchmaking/matchmaking.service').BlindTier },
  ) {
    return handleQuickMatch(this, client, data);
  }

  @SubscribeMessage('show_cards')
  async handleShowCards(@ConnectedSocket() client: Socket) {
    return handleShowCards(this, client);
  }
}
