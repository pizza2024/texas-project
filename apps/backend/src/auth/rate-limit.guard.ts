import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';

export const RATE_LIMIT_KEY = 'rateLimitOptions';

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Redis key prefix */
  keyPrefix: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private redisService: RedisService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const ip =
      (request.ip as string) ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      'unknown';

    // Use userId if available (logged-in users), otherwise fall back to IP
    const userId = request.user?.userId ?? '';
    const key = userId
      ? `${options.keyPrefix}:${userId}`
      : `${options.keyPrefix}:${ip}`;

    const count = await this.redisService.incr(key, options.windowSeconds);

    // If Redis unavailable, allow the request
    if (count === null) return true;

    const { limit, windowSeconds } = options;
    const remaining = Math.max(0, limit - count);
    const resetIn = await this.redisService.ttl(key);
    const resetAt =
      resetIn > 0
        ? Date.now() + resetIn * 1000
        : Date.now() + windowSeconds * 1000;

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (count > limit) {
      const retryAfter = Math.max(1, await this.redisService.ttl(key));
      response.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

/** Shorthand decorator to apply rate limit to a route handler */
export const ApplyRateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
