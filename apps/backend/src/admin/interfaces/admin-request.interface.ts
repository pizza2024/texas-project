import { Request } from 'express';

export interface AdminUser {
  sub: string;
  username: string;
  nickname?: string;
  role: string;
  sessionId?: string;
}

/**
 * Extended Express Request with authenticated admin user (set by AdminGuard).
 */
export interface AdminRequest extends Request {
  admin: AdminUser;
}
