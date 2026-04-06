import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtPayload, JwtUser } from './interfaces/jwt-user.interface';
import { RedisService } from '../redis/redis.service';
import { getJwtSecret } from '../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.sessionId) {
      if (!this.redisService.isAvailable) {
        // Security trade-off: Redis down + reject all = total service outage.
        // Instead we allow auth but log a HIGH-severity warning for security team to act on.
        this.logger.warn(
          `[SECURITY] Redis unavailable — session validation SKIPPED for user ${payload.sub}. ` +
            `Single-device login protection is temporarily disabled.`,
        );
      } else {
        const stored = await this.redisService.get(
          `user_session:${payload.sub}`,
        );
        if (stored !== payload.sessionId) {
          throw new UnauthorizedException('SESSION_REPLACED');
        }
      }
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role ?? 'PLAYER',
    };
  }
}
