import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private available = false;

  onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableOfflineQueue: false,
    });

    this.client.on('connect', () => {
      this.available = true;
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err: Error) => {
      if (this.available) {
        this.logger.warn(
          `Redis error: ${err.message} — falling back to SQLite only`,
        );
      }
      this.available = false;
    });

    this.client.on('close', () => {
      this.available = false;
    });

    // Attempt initial connection (non-blocking — game continues without Redis)
    this.client.connect().catch(() => {
      this.logger.warn('Redis unavailable — game state will use SQLite only');
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  get isAvailable(): boolean {
    return this.available;
  }

  async get(key: string): Promise<string | null> {
    if (!this.available || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds = 86400): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch {
      // non-fatal
    }
  }

  async del(key: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // non-fatal
    }
  }

  /**
   * SET if Not eXists — atomic lock acquisition with TTL.
   * Returns true if key was set (lock acquired), false if key already existed.
   * Returns null if Redis is unavailable.
   */
  async setNX(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    if (!this.available || !this.client) return null;
    try {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return null;
    }
  }

  /** Atomically increment a key and return its new value. Sets TTL on first set. Returns null if Redis unavailable. */
  async incr(key: string, ttlSeconds?: number): Promise<number | null> {
    if (!this.available || !this.client) return null;
    try {
      const newVal = await this.client.incr(key);
      if (ttlSeconds && newVal === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return newVal;
    } catch {
      return null;
    }
  }

  /** Get remaining TTL of a key in seconds. Returns -2 if key doesn't exist, -1 if no TTL set. */
  async ttl(key: string): Promise<number> {
    if (!this.available || !this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch {
      return -2;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Add a member with score to a sorted set (for tournament blind timers).
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.zadd(key, score, member);
    } catch {
      // non-fatal
    }
  }

  /**
   * Remove a member from a sorted set.
   */
  async zrem(key: string, member: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.zrem(key, member);
    } catch {
      // non-fatal
    }
  }

  /**
   * Push a value to the head of a list (LPUSH).
   */
  async lpush(key: string, ...values: string[]): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.lpush(key, ...values);
    } catch {
      // non-fatal
    }
  }

  /**
   * Get all members of a list (LRANGE 0 -1).
   * Returns empty array if Redis unavailable.
   */
  async lrange(key: string): Promise<string[]> {
    if (!this.available || !this.client) return [];
    try {
      return await this.client.lrange(key, 0, -1);
    } catch {
      return [];
    }
  }

  /**
   * Remove a member from a list by value (LREM).
   */
  async lrem(key: string, value: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.lrem(key, 1, value);
    } catch {
      // non-fatal
    }
  }

  /**
   * Set a hash field (HSET).
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.hset(key, field, value);
    } catch {
      // non-fatal
    }
  }

  /**
   * Get all fields and values of a hash (HGETALL).
   * Returns null if Redis unavailable or key doesn't exist.
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.available || !this.client) return null;
    try {
      const result = await this.client.hgetall(key);
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  }
}
