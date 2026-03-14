import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
        this.logger.warn(`Redis error: ${err.message} — falling back to SQLite only`);
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

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }
}
