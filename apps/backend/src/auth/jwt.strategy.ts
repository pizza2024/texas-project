import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload, JwtUser } from './interfaces/jwt-user.interface';
import { RedisService } from '../redis/redis.service';
import { getJwtSecret } from '../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private redisService: RedisService) {
    super({
      jwtFromRequest: (req: Request) => {
        // First try Authorization header (Bearer token)
        const authHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (authHeader) return authHeader;
        // Fallback: read from httpOnly cookie
        return req.cookies?.access_token ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtUser> {
    if (payload.sessionId) {
      if (!this.redisService.isAvailable) {
        // Redis unavailable + sessionId present = fail-closed (deny auth).
        // This ensures Redis outages don't create security holes by allowing
        // stale/rogue sessions to authenticate without session validation.
        this.logger.error(
          `[SECURITY] Redis unavailable — session validation FAILED for user ${payload.sub}. ` +
            `Authentication denied until Redis is restored. ` +
            `Timestamp: ${new Date().toISOString()}.`,
        );
        throw new UnauthorizedException('AUTH_SERVICE_UNAVAILABLE');
      }
      const stored = await this.redisService.get(`user_session:${payload.sub}`);
      if (stored !== payload.sessionId) {
        throw new UnauthorizedException('SESSION_REPLACED');
      }
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role ?? 'PLAYER',
    };
  }
}
