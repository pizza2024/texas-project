import { disconnectSocket } from './socket';
import { showSystemMessage } from './system-message';

const TOKEN_STORAGE_KEY = 'token';
const POST_LOGIN_REDIRECT_KEY = 'post-login-redirect';
const AUTH_EXPIRED_LOCK_KEY = 'auth-expired-lock';

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}

export function getStoredToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearStoredToken() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getTokenPayload(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    return JSON.parse(decodeBase64Url(payload)) as { sub?: string; exp?: number; username?: string };
  } catch {
    return null;
  }
}

export function getTokenExpiryTime(token: string) {
  const payload = getTokenPayload(token);
  if (!payload?.exp || !Number.isFinite(payload.exp)) {
    return null;
  }

  return payload.exp * 1000;
}

export function isTokenExpired(token: string, skewMs = 0) {
  const expiresAt = getTokenExpiryTime(token);
  if (!expiresAt) {
    return true;
  }

  return Date.now() + skewMs >= expiresAt;
}

export function rememberPostLoginRedirect(path: string) {
  if (typeof window === 'undefined' || !path.startsWith('/room/')) {
    return;
  }

  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

export function consumePostLoginRedirect() {
  if (typeof window === 'undefined') {
    return null;
  }

  const path = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (path) {
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  }

  return path;
}

export async function handleExpiredSession(options?: {
  alertMessage?: string;
  redirectTo?: string;
  returnTo?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  if (sessionStorage.getItem(AUTH_EXPIRED_LOCK_KEY) === '1') {
    return;
  }

  sessionStorage.setItem(AUTH_EXPIRED_LOCK_KEY, '1');

  if (options?.returnTo) {
    rememberPostLoginRedirect(options.returnTo);
  }

  clearStoredToken();
  disconnectSocket();

  if (options?.alertMessage) {
    await showSystemMessage({
      title: '登录已过期',
      message: options.alertMessage,
      confirmText: '重新登录',
    });
  }

  const redirectTo = options?.redirectTo ?? '/login';
  window.location.replace(redirectTo);
}

export function clearAuthExpiredLock() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(AUTH_EXPIRED_LOCK_KEY);
}
