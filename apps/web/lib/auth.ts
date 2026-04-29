import {
  getTokenPayload,
  getTokenExpiryTime,
  isTokenExpired,
} from "@texas/shared";
import { disconnectSocket } from "./socket";
import { showSystemMessage } from "./system-message";

export { getTokenPayload, getTokenExpiryTime, isTokenExpired };

const TOKEN_STORAGE_KEY = "token";
const POST_LOGIN_REDIRECT_KEY = "post-login-redirect";
const AUTH_EXPIRED_LOCK_KEY = "auth-expired-lock";

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearStoredToken() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function rememberPostLoginRedirect(path: string) {
  if (typeof window === "undefined" || !path.startsWith("/room/")) {
    return;
  }

  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

export function consumePostLoginRedirect() {
  if (typeof window === "undefined") {
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
  if (typeof window === "undefined") {
    return;
  }

  if (sessionStorage.getItem(AUTH_EXPIRED_LOCK_KEY) === "1") {
    return;
  }

  sessionStorage.setItem(AUTH_EXPIRED_LOCK_KEY, "1");

  if (options?.returnTo) {
    rememberPostLoginRedirect(options.returnTo);
  }

  clearStoredToken();
  disconnectSocket();

  if (options?.alertMessage) {
    await showSystemMessage({
      title: "登录已过期",
      message: options.alertMessage,
      confirmText: "重新登录",
    });
  }

  const redirectTo = options?.redirectTo ?? "/login";
  window.location.replace(redirectTo);
}

export function clearAuthExpiredLock() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(AUTH_EXPIRED_LOCK_KEY);
}
