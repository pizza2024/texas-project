import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_ACTIONS,
  CHAT_RATE_LIMIT_WINDOW_MS,
  CHAT_RATE_LIMIT_MAX,
  EMOJI_RATE_LIMIT_WINDOW_MS,
  EMOJI_RATE_LIMIT_MAX,
} from './constants';

@Injectable()
export class ConnectionStateService {
  private readonly logger = new Logger(ConnectionStateService.name);

  // ── User→socket index (O(1) lookup instead of fetchSockets O(n)) ───────
  /** Maps userId → Set of their active socket IDs */
  userSockets = new Map<string, Set<string>>();

  // ── Rate limiter ────────────────────────────────────────────────────────
  rateLimits = new Map<string, { count: number; windowStart: number }>();

  // ── Password brute-force protection ─────────────────────────────────────
  // Redis-backed (multi-instance safe); fail-closed if Redis unavailable.
  private readonly PASSWORD_ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PASSWORD_ATTEMPT_MAX = 5; // 5 wrong passwords per window
  private readonly PASSWORD_BAN_MS = 30 * 60 * 1000; // 30 minute ban per IP+roomId

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

    // Redis unavailable — DENY all requests rather than bypass via in-memory fallback.
    // In-memory fallback was a security gap: multi-instance deployments could bypass
    // rate limits by routing requests to instances with no prior record.
    // Blocking all requests when Redis is down is the safe default (fail-closed).
    this.logger.warn(
      `[RATE-LIMIT] Redis unavailable for user=${userId} — denying request (fail-closed)`,
    );
    return false;
  }

  /**
   * Chat message rate limit — separate key from game action rate limit.
   * Redis key: ws_chat:{userId} — TTL = CHAT_RATE_LIMIT_WINDOW_MS in seconds.
   * Allow 1 message per 5-second window to prevent spam.
   */
  async checkChatRateLimit(userId: string): Promise<boolean> {
    const windowSec = Math.ceil(CHAT_RATE_LIMIT_WINDOW_MS / 1000);
    const count = await this.redisService.incr(`ws_chat:${userId}`, windowSec);

    if (count !== null) {
      return count <= CHAT_RATE_LIMIT_MAX;
    }

    this.logger.warn(
      `[CHAT-RATE-LIMIT] Redis unavailable for user=${userId} — denying message (fail-closed)`,
    );
    return false;
  }

  /**
   * Emoji reaction rate limit — separate key from game action and chat rate limits.
   * Redis key: ws_emoji:{userId} — TTL = EMOJI_RATE_LIMIT_WINDOW_MS in seconds.
   * Allow 1 emoji per 3-second window to prevent spam.
   */
  async checkEmojiRateLimit(userId: string): Promise<boolean> {
    const windowSec = Math.ceil(EMOJI_RATE_LIMIT_WINDOW_MS / 1000);
    const count = await this.redisService.incr(`ws_emoji:${userId}`, windowSec);

    if (count !== null) {
      return count <= EMOJI_RATE_LIMIT_MAX;
    }

    this.logger.warn(
      `[EMOJI-RATE-LIMIT] Redis unavailable for user=${userId} — denying reaction (fail-closed)`,
    );
    return false;
  }

  // ── Password brute-force check ──────────────────────────────────────────

  /**
   * Check if an IP+roomId combo is banned due to too many wrong password attempts.
   * Returns 'banned' | 'rate_limited' | 'ok'.
   * Uses Redis for multi-instance safety; fail-closed (deny) if Redis unavailable.
   * Redis key: brute:{ip}:{roomId}, TTL = PASSWORD_ATTEMPT_WINDOW_MS.
   */
  async checkPasswordAttemptLimit(
    ip: string,
    roomId: string,
  ): Promise<'banned' | 'rate_limited' | 'ok'> {
    const key = `brute:${ip}:${roomId}`;
    const windowSec = Math.ceil(this.PASSWORD_ATTEMPT_WINDOW_MS / 1000);
    const count = await this.redisService.incr(key, windowSec);

    // Redis unavailable — fail-closed (deny access) since we cannot safely
    // track attempts across multiple instances without Redis.
    if (count === null) {
      this.logger.warn(
        `[SECURITY-BRUTE-FORCE] Redis unavailable for IP=${ip} roomId=${roomId} — denying request (fail-closed)`,
      );
      return 'banned';
    }

    const now = Date.now();

    if (count > this.PASSWORD_ATTEMPT_MAX) {
      const ttl = await this.redisService.ttl(key);
      const banRemaining = Math.ceil(
        Math.max(0, ttl) +
          (this.PASSWORD_BAN_MS - this.PASSWORD_ATTEMPT_WINDOW_MS) / 1000,
      );
      this.logger.warn(
        `[SECURITY-BRUTE-FORCE] IP=${ip} roomId=${roomId} banned for ${banRemaining}s ` +
          `(attempt #${count} exceeds limit ${this.PASSWORD_ATTEMPT_MAX})`,
      );
      return 'banned';
    }

    if (count >= this.PASSWORD_ATTEMPT_MAX - 2) {
      // Warn at 3rd and 4th failed attempts
      this.logger.warn(
        `[SECURITY-BRUTE-FORCE] IP=${ip} roomId=${roomId} ` +
          `wrong password attempt #${count}/${this.PASSWORD_ATTEMPT_MAX}`,
      );
    }

    return 'ok';
  }

  /**
   * Clear password attempt counter on successful join.
   * Call this when the user successfully joins (password correct or no password).
   */
  async clearPasswordAttempts(ip: string, roomId: string): Promise<void> {
    const key = `brute:${ip}:${roomId}`;
    await this.redisService.del(key);
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
    socketId: string,
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

        if (await hasOtherActiveSocketFn(userId, socketId)) {
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
