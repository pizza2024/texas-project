import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, JwtUser } from './interfaces/jwt-user.interface';
import { RedisService } from '../redis/redis.service';
import { getJwtSecret } from '../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.sessionId && this.redisService.isAvailable) {
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
