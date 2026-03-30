import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const MAINTENANCE_KEY = 'system:maintenance';

@Injectable()
export class SystemStateService implements OnModuleInit {
  private readonly logger = new Logger(SystemStateService.name);
  private maintenanceMode = false;

  constructor(private redis: RedisService) {}

  async onModuleInit() {
    await this.loadMaintenanceMode();
  }

  private async loadMaintenanceMode() {
    try {
      const stored = await this.redis.get(MAINTENANCE_KEY);
      this.maintenanceMode = stored === 'true';
      this.logger.log(
        `Maintenance mode loaded from Redis: ${this.maintenanceMode}`,
      );
    } catch {
      this.logger.warn('Redis unavailable, maintenance mode defaults to false');
    }
  }

  isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  async setMaintenanceMode(enabled: boolean): Promise<void> {
    this.maintenanceMode = enabled;
    try {
      await this.redis.set(MAINTENANCE_KEY, String(enabled));
    } catch {
      this.logger.warn('Failed to persist maintenance mode to Redis');
    }
  }
}
