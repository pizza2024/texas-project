import { Injectable, Logger, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';

export const WS_REDIS_CHANNEL = 'ws:broadcast';

@Injectable()
export class WebSocketManager {
  private server: Server;
  private readonly logger = new Logger(WebSocketManager.name);
  // ── Redis Pub/Sub for multi-instance support ────────────────────────────────
  private redisSub: Redis | null = null;
  private redisPub: Redis | null = null;
  // ── In-memory index of local sockets (same as before) ────────────────────
  private localSockets = new Map<string, Set<string>>(); // userId → socketIds

  setServer(server: Server) {
    this.server = server;
    this.logger.log('WebSocket server registered');
  }

  /**
   * Inject a shared Redis client for pub/sub.
   * Must be called once after RedisService is available.
   */
  initRedis(redisUrl: string) {
    if (this.redisSub) return; // already initialized

    try {
      // Subscriber — receives cross-instance broadcasts
      this.redisSub = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
      });

      // Publisher — sends broadcasts to other instances
      this.redisPub = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
      });

      this.redisSub.on('error', (err) => {
        this.logger.warn(`Redis sub error: ${err.message}`);
      });
      this.redisPub.on('error', (err) => {
        this.logger.warn(`Redis pub error: ${err.message}`);
      });

      // Subscribe to the broadcast channel
      this.redisSub.subscribe(WS_REDIS_CHANNEL, (err) => {
        if (err) {
          this.logger.warn(`Redis subscribe error: ${err.message}`);
        } else {
          this.logger.log(`Redis subscribed to ${WS_REDIS_CHANNEL}`);
        }
      });

      // Deliver incoming cross-instance messages to local sockets
      this.redisSub.on('message', (channel, message) => {
        if (channel !== WS_REDIS_CHANNEL) return;
        try {
          const { userId, event, data } = JSON.parse(message) as {
            userId: string;
            event: string;
            data: unknown;
          };
          this.deliverToLocalUser(userId, event, data);
        } catch {
          // ignore malformed messages
        }
      });

      this.logger.log('WebSocket Redis bridge initialized');
    } catch (err) {
      this.logger.warn(`Failed to init Redis bridge: ${err}`);
    }
  }

  /**
   * Register a socket as belonging to a user (call from handleConnection).
   * Enables O(1) local lookup in deliverToLocalUser.
   */
  registerSocket(userId: string, socketId: string) {
    let sockets = this.localSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.localSockets.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  /**
   * Unregister a socket (call from handleDisconnect).
   */
  unregisterSocket(userId: string, socketId: string) {
    this.localSockets.get(userId)?.delete(socketId);
  }

  getServer(): Server | null {
    return this.server;
  }

  sendToAll<T = unknown>(event: string, data: T) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  /**
   * 向指定用户的 所有 WebSocket 连接发送事件。
   * Uses Redis pub/sub to reach users on ANY instance.
   */
  emitToUser<T = unknown>(userId: string, event: string, data: T): void {
    if (!this.server) return;

    // 1. Deliver to local sockets immediately (no Redis round-trip)
    this.deliverToLocalUser(userId, event, data);

    // 2. Broadcast to other instances via Redis (if available)
    if (this.redisPub && this.redisPub.status === 'ready') {
      const message = JSON.stringify({ userId, event, data });
      this.redisPub.publish(WS_REDIS_CHANNEL, message).catch(() => {
        // non-fatal — local delivery already done
      });
    }
  }

  /**
   * Deliver an event to all local sockets for a given userId.
   */
  private deliverToLocalUser<T = unknown>(
    userId: string,
    event: string,
    data: T,
  ) {
    if (!this.server) return;
    const sockets = this.localSockets.get(userId);
    if (!sockets) return;

    for (const socketId of Array.from(sockets)) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    }
  }

  getConnectedCount(): number {
    if (!this.server) return 0;
    return this.server.sockets.sockets.size;
  }
}
