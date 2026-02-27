export interface JwtPayload {
  sub: string;
  username: string;
}

export interface JwtUser {
  userId: string;
  username: string;
}
