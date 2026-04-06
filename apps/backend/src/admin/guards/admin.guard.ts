import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(authHeader.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Role is embedded in JWT payload at login time — no DB round-trip needed.
    // If an admin is demoted mid-session the token remains valid until expiry
    // (typically ≤ 1 h), which is an acceptable security tradeoff vs the cost of
    // a DB query on every admin API call.
    const role: string = payload.role ?? 'PLAYER';
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    request.admin = { ...payload, role };
    return true;
  }
}
