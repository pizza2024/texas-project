export interface JwtPayload {
  sub: string;
  username: string;
  nickname?: string;
  role?: string;
  sessionId?: string;
}

export interface JwtUser {
  userId: string;
  username: string;
  role?: string;
}
