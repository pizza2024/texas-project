export interface JwtPayload {
  sub: string;
  username: string;
  sessionId?: string;
}

export interface JwtUser {
  userId: string;
  username: string;
}
