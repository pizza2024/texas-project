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
import { Server, Socket } from 'socket.io';
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
import { ConnectionStateService } from './connection-state.service';
import { BroadcastService } from './broadcast.service';
import { TimerService } from './timer.service';

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
  // NOTE: SOLO_READY_COUNTDOWN_MS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ACTIONS
  // are defined in ./constants.ts and imported directly by game.handler.ts.
  // DISCONNECT_GRACE_PERIOD_MS, SETTLEMENT_DURATION_MS, READY_COUNTDOWN_MS,
  // ACTION_DURATION_MS are defined in timer.service.ts (AppGatewayConstants).

  // ── WebSocket server ────────────────────────────────────────────────────
  @WebSocketServer() server: Server;

  // ── Logger (public so handlers can use it) ──────────────────────────────
  readonly logger: Logger = new Logger('AppGateway');

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
    private connectionState: ConnectionStateService,
    private readonly broadcastService: BroadcastService,
    private readonly timerService: TimerService,
  ) {}

  // ── Delegating getters for ConnectionStateService ───────────────────────

  get userSockets() {
    return this.connectionState.userSockets;
  }

  get pendingDisconnects() {
    return this.connectionState.pendingDisconnects;
  }

  async checkRateLimit(userId: string) {
    return this.connectionState.checkRateLimit(userId);
  }

  checkPasswordAttemptLimit(ip: string, roomId: string) {
    return this.connectionState.checkPasswordAttemptLimit(ip, roomId);
  }

  clearPasswordAttempts(ip: string, roomId: string) {
    return this.connectionState.clearPasswordAttempts(ip, roomId);
  }

  hasOtherActiveSocket(userId: string, socketId: string) {
    return this.connectionState.hasOtherActiveSocket(
      this.connectionState.userSockets,
      this.server,
      userId,
      socketId,
    );
  }

  clearPendingDisconnect(userId: string) {
    return this.connectionState.clearPendingDisconnect(userId);
  }

  scheduleDisconnectCleanup(userId: string) {
    return this.connectionState.scheduleDisconnectCleanup(
      userId,
      (uid) => this.tableManager.getUserCurrentRoomId(uid),
      (uid, sid) => this.hasOtherActiveSocket(uid, sid),
      <T>(roomId: string, fn: () => Promise<T>) =>
        this.withRoomLock(roomId, fn),
      (uid) => this.tableManager.leaveCurrentRoom(uid),
      (rid) => this.tableManager.getTable(rid),
      (rid, tbl) => this.broadcastTableState(rid, tbl),
      (rid) => this.clearRoundTimers(rid),
      (rid, tbl) => this.schedulePostHandFlow(this.server, rid, tbl),
      (stage) => this.isActionStage(stage),
      (rid, tbl) => this.scheduleActionTimeout(this.server, rid, tbl),
      TimerService.DISCONNECT_GRACE_PERIOD_MS,
      this.logger,
    );
  }

  // ── Timer and broadcast delegates (used by game.handler.ts) ──────────────

  /**
   * @deprecated Delegates to BroadcastService.broadcastTableState.
   *   Handlers should migrate to using broadcastService directly.
   */
  async broadcastTableState(
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    return this.broadcastService.broadcastTableState(
      this.server,
      roomId,
      table,
    );
  }

  clearRoundTimers(roomId: string) {
    return this.timerService.clearRoundTimers(roomId);
  }

  isActionStage(stage: GameStage) {
    return this.timerService.isActionStage(stage);
  }

  async scheduleActionTimeout(
    server: any,
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    return this.timerService.scheduleActionTimeout(server, roomId, table);
  }

  async scheduleAutoStart(
    server: any,
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs?: number,
  ) {
    return this.timerService.scheduleAutoStart(
      server,
      roomId,
      table,
      durationMs,
    );
  }

  async schedulePostHandFlow(
    server: any,
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    return this.timerService.schedulePostHandFlow(server, roomId, table);
  }

  async ensureRecoveredRoundFlow(
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    return this.timerService.ensureRecoveredRoundFlow(
      this.server,
      roomId,
      table,
    );
  }

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
          // Clean up userSockets index for the evicted socket
          const otherUserId = other.data.user?.sub as string | undefined;
          if (otherUserId) {
            this.connectionState.userSockets.get(otherUserId)?.delete(other.id);
          }
        }
      }

      // Register new socket in userSockets index
      const existing = this.connectionState.userSockets.get(payload.sub);
      if (existing) {
        existing.add(client.id);
      } else {
        this.userSockets.set(payload.sub, new Set([client.id]));
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

    // Remove socket from userSockets index immediately so
    // hasOtherActiveSocket reflects the post-disconnect state.
    this.connectionState.userSockets.get(userId)?.delete(client.id);

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

    this.connectionState.scheduleDisconnectCleanup(
      userId,
      (uid) => this.tableManager.getUserCurrentRoomId(uid),
      (uid, sid) =>
        this.connectionState.hasOtherActiveSocket(
          this.connectionState.userSockets,
          this.server,
          uid,
          sid,
        ),
      <T>(roomId: string, fn: () => Promise<T>) =>
        this.withRoomLock(roomId, fn),
      (uid) => this.tableManager.leaveCurrentRoom(uid),
      (rid) => this.tableManager.getTable(rid),
      (rid, tbl) => this.broadcastTableState(rid, tbl),
      (rid) => this.clearRoundTimers(rid),
      (rid, tbl) => this.schedulePostHandFlow(this.server, rid, tbl),
      (stage) => this.isActionStage(stage),
      (rid, tbl) => this.scheduleActionTimeout(this.server, rid, tbl),
      TimerService.DISCONNECT_GRACE_PERIOD_MS,
      this.logger,
    );
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
    this.connectionState.clearAllPendingDisconnects();
    // TimerService handles its own timer cleanup via OnModuleDestroy
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

    const prevLock = this.roomLocks.get(roomId) ?? Promise.resolve();

    // Chain onto prevLock so that subsequent callers wait for this fn to finish.
    // next resolves/rejects with fn's result; we re-export both outcomes to outer.
    const next = prevLock.then(() => fn()).then(resolve, reject);

    // Clean up AFTER fn settles — never before.
    next.finally(() => this.roomLocks.delete(roomId));

    // Store a promise that absorbs fn's rejection so the Map entry NEVER
    // stores a rejected promise. This prevents subsequent callers from
    // seeing a rejected prev and short-circuiting the queue.
    this.roomLocks.set(
      roomId,
      next.then(() => {}).catch(() => {}),
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

    const prevLock = this.userLocks.get(userId) ?? Promise.resolve();
    const next = prevLock.then(() => fn()).then(resolve, reject);
    next.finally(() => this.userLocks.delete(userId));
    this.userLocks.set(
      userId,
      next.then(() => {}).catch(() => {}),
    );

    return outer;
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
