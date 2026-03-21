/**
 * token 存储 adapter 接口。
 * web: 传入 localStorage
 * mobile: 传入 expo-secure-store（需包装为同步/异步统一接口）
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const TOKEN_KEY = 'token';
const POST_LOGIN_REDIRECT_KEY = 'post-login-redirect';

// ── JWT 工具 ─────────────────────────────────────────────────────────────────

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}

export function getTokenPayload(
  token: string,
): { sub?: string; exp?: number; username?: string } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as { sub?: string; exp?: number; username?: string };
  } catch {
    return null;
  }
}

export function getTokenExpiryTime(token: string): number | null {
  const payload = getTokenPayload(token);
  if (!payload?.exp || !Number.isFinite(payload.exp)) return null;
  return payload.exp * 1000;
}

export function isTokenExpired(token: string, skewMs = 0): boolean {
  const expiresAt = getTokenExpiryTime(token);
  if (!expiresAt) return true;
  return Date.now() + skewMs >= expiresAt;
}

// ── Auth service factory ──────────────────────────────────────────────────────

export function createAuthService(storage: StorageAdapter) {
  return {
    getToken: (): string | null | Promise<string | null> =>
      storage.getItem(TOKEN_KEY),

    setToken: (token: string): void | Promise<void> =>
      storage.setItem(TOKEN_KEY, token),

    removeToken: (): void | Promise<void> =>
      storage.removeItem(TOKEN_KEY),

    rememberRedirect: (path: string): void | Promise<void> => {
      if (!path.startsWith('/room/')) return;
      return storage.setItem(POST_LOGIN_REDIRECT_KEY, path);
    },

    consumeRedirect: async (): Promise<string | null> => {
      const path = await storage.getItem(POST_LOGIN_REDIRECT_KEY);
      if (path) await storage.removeItem(POST_LOGIN_REDIRECT_KEY);
      return path ?? null;
    },

    getTokenPayload,
    getTokenExpiryTime,
    isTokenExpired,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
