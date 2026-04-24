import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ACTIONS } from './constants';

@Injectable()
export class ConnectionStateService {
  private readonly logger = new Logger(ConnectionStateService.name);

  // ── User→socket index (O(1) lookup instead of fetchSockets O(n)) ───────
  /** Maps userId → Set of their active socket IDs */
  userSockets = new Map<string, Set<string>>();

  // ── Rate limiter ────────────────────────────────────────────────────────
  rateLimits = new Map<string, { count: number; windowStart: number }>();

  // ── Password brute-force protection ─────────────────────────────────────
  private passwordAttempts = new Map<
    string,
    { count: number; windowStart: number }
  >();

  private readonly PASSWORD_ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PASSWORD_ATTEMPT_MAX = 5; // 5 wrong passwords per window
  private readonly PASSWORD_BAN_MS = 5 * 60 * 1000; // 5 minute ban per IP+roomId

  // ── Pending disconnects ──────────────────────────────────────────────────
  pendingDisconnects = new Map<string, NodeJS.Timeout>();

  constructor(private readonly redisService: RedisService) {}

  // ── Rate limit check ────────────────────────────────────────────────────

  /**
   * Redis-backed rate limit check with in-memory Map fallback.
   * Redis key: ws_rate:{userId} — TTL = RATE_LIMIT_WINDOW_MS in seconds
   * Falls back to in-memory Map if Redis is unavailable.
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const windowSec = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    const count = await this.redisService.incr(`ws_rate:${userId}`, windowSec);

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

  // ── Password brute-force check ──────────────────────────────────────────

  /**
   * Check if an IP+roomId combo is banned due to too many wrong password attempts.
   * Returns 'banned' | 'rate_limited' | 'ok'.
   * Logs [SECURITY-BRUTE-FORCE] events for SIEM alerting.
   */
  checkPasswordAttemptLimit(
    ip: string,
    roomId: string,
  ): 'banned' | 'rate_limited' | 'ok' {
    const key = `${ip}:${roomId}`;
    const now = Date.now();
    const entry = this.passwordAttempts.get(key);
    const windowStart = entry?.windowStart ?? now;
    const cnt = entry?.count ?? 0;

    // Reset window if expired
    if (now - windowStart > this.PASSWORD_ATTEMPT_WINDOW_MS) {
      this.passwordAttempts.set(key, { count: 1, windowStart: now });
      return 'ok';
    }

    if (cnt >= this.PASSWORD_ATTEMPT_MAX) {
      const banRemaining = Math.ceil(
        (this.PASSWORD_BAN_MS - (now - windowStart)) / 1000,
      );
      this.logger.warn(
        `[SECURITY-BRUTE-FORCE] IP=${ip} roomId=${roomId} banned for ${banRemaining}s ` +
          `(attempt #${cnt} exceeds limit ${this.PASSWORD_ATTEMPT_MAX})`,
      );
      return 'banned';
    }

    this.passwordAttempts.set(key, { count: cnt + 1, windowStart });

    if (cnt >= this.PASSWORD_ATTEMPT_MAX - 2) {
      // Warn at 3rd and 4th failed attempts
      this.logger.warn(
        `[SECURITY-BRUTE-FORCE] IP=${ip} roomId=${roomId} ` +
          `wrong password attempt #${cnt + 1}/${this.PASSWORD_ATTEMPT_MAX}`,
      );
    }

    return 'ok';
  }

  /**
   * Clear password attempt counter on successful join.
   * Call this when the user successfully joins (password correct or no password).
   */
  clearPasswordAttempts(ip: string, roomId: string): void {
    const key = `${ip}:${roomId}`;
    this.passwordAttempts.delete(key);
  }

  // ── Socket registration ────────────────────────────────────────────────

  /**
   * Check if userId has any active socket other than socketId.
   * Uses the userSockets index (O(1)) when populated; falls back to
   * fetchSockets() (O(n)) for test environments where the index is empty.
   */
  async hasOtherActiveSocket(
    userSockets: Map<string, Set<string>>,
    server: any,
    userId: string,
    socketId: string,
  ): Promise<boolean> {
    const sockets = userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      // Index is populated — O(1) lookup
      for (const id of sockets) {
        if (id !== socketId) return true;
      }
      return false;
    }
    // Fallback: scan all sockets (test mocks, or if index is empty)
    const allSockets = await server.fetchSockets();
    return allSockets.some(
      (socket: any) =>
        socket.id !== socketId &&
        (socket.data.user?.sub as string | undefined) === userId,
    );
  }

  // ── Pending disconnect management ───────────────────────────────────────

  clearPendingDisconnect(userId: string) {
    const timeout = this.pendingDisconnects.get(userId);
    if (!timeout) return;
    clearTimeout(timeout);
    this.pendingDisconnects.delete(userId);
  }

  scheduleDisconnectCleanup(
    userId: string,
    getUserCurrentRoomId: (userId: string) => Promise<string | null>,
    hasOtherActiveSocketFn: (
      userId: string,
      socketId: string,
    ) => Promise<boolean>,
    withRoomLock: <T>(roomId: string, fn: () => Promise<T>) => Promise<T>,
    leaveCurrentRoom: (userId: string) => Promise<any>,
    getTable: (roomId: string) => Promise<any>,
    broadcastTableState: (roomId: string, table: any) => Promise<void>,
    clearRoundTimers: (roomId: string) => void,
    schedulePostHandFlow: (roomId: string, table: any) => Promise<void>,
    isActionStage: (stage: any) => boolean,
    scheduleActionTimeout: (roomId: string, table: any) => Promise<void>,
    DISCONNECT_GRACE_PERIOD_MS: number,
    logger: Logger,
  ) {
    this.clearPendingDisconnect(userId);

    const timeout = setTimeout(async () => {
      try {
        this.pendingDisconnects.delete(userId);

        if (await hasOtherActiveSocketFn(userId, client.id)) {
          return;
        }

        const roomId = await getUserCurrentRoomId(userId);
        if (!roomId) return;

        await withRoomLock(roomId, async () => {
          const result = await leaveCurrentRoom(userId);
          if (!result) return;

          if (result.dissolved) {
            clearRoundTimers(roomId);
          } else if (result.reachedSettlement) {
            const table = await getTable(roomId);
            if (table) {
              await schedulePostHandFlow(roomId, table);
              await broadcastTableState(roomId, table);
            }
          } else {
            const table = await getTable(roomId);
            if (table) {
              if (isActionStage(table.currentStage)) {
                await scheduleActionTimeout(roomId, table);
              }
              await broadcastTableState(roomId, table);
            }
          }
        });
      } catch (err) {
        logger.error(
          `scheduleDisconnectCleanup error for user ${userId}: ${(err as Error).message}`,
        );
      }
    }, DISCONNECT_GRACE_PERIOD_MS);

    this.pendingDisconnects.set(userId, timeout);
  }

  // ── Cleanup on module destroy ──────────────────────────────────────────

  clearAllPendingDisconnects() {
    for (const timeout of this.pendingDisconnects.values())
      clearTimeout(timeout);
    this.pendingDisconnects.clear();
  }
}
