import 'express';

export interface AdminRequest {
  admin: {
    sub: string;
    role: string;
    username?: string;
  };
}

declare module 'express' {
  interface Request {
    admin?: {
      sub: string;
      role: string;
      username?: string;
    };
  }
}
