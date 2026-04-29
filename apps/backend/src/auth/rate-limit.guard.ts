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
  /** Which dimension to limit on. Defaults to userOrIp. */
  keyType?: 'userOrIp' | 'ip' | 'user' | 'emailOrIp';
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

    const forwardedFor = (request.headers['x-forwarded-for'] as string)
      ?.split(',')[0]
      ?.trim();
    const ip = forwardedFor || (request.ip as string) || 'unknown';
    const userId = request.user?.userId ?? '';
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : '';

    const keyType = options.keyType ?? 'userOrIp';
    const isDevEnv =
      (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

    const shouldBypassIpInDev =
      isDevEnv &&
      ((keyType === 'ip' && !userId && !email) ||
        (keyType === 'userOrIp' && !userId) ||
        (keyType === 'emailOrIp' && !email) ||
        (keyType === 'user' && !userId));

    // Local development: do not limit by IP fallback.
    if (shouldBypassIpInDev) {
      return true;
    }

    let keyIdentity: string;

    switch (keyType) {
      case 'ip':
        keyIdentity = ip;
        break;
      case 'user':
        keyIdentity = userId || ip;
        break;
      case 'emailOrIp':
        keyIdentity = email || ip;
        break;
      case 'userOrIp':
      default:
        keyIdentity = userId || ip;
        break;
    }

    const key = `${options.keyPrefix}:${keyIdentity}`;

    const count = await this.redisService.incr(key, options.windowSeconds);

    // fail-closed: if Redis is unavailable, reject the request to prevent
    // rate limiting from being bypassed during Redis outages
    if (count === null) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Rate limit service temporarily unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

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
