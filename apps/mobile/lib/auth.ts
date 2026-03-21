/**
 * 移动端 auth 工具
 * 使用 expo-secure-store 存储 token（比 AsyncStorage 更安全）
 */
import * as SecureStore from 'expo-secure-store';
import {
  createAuthService,
  getTokenPayload,
  getTokenExpiryTime,
  isTokenExpired,
} from '@texas/shared';
import type { StorageAdapter } from '@texas/shared';

const secureStoreAdapter: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const authService = createAuthService(secureStoreAdapter);

export { getTokenPayload, getTokenExpiryTime, isTokenExpired };

/** 获取存储的 token（便捷方法） */
export const getStoredToken = async (): Promise<string | null> =>
  authService.getToken() as Promise<string | null>;

export const setStoredToken = (token: string) => authService.setToken(token);

export const clearStoredToken = () => authService.removeToken();
