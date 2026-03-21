import axios from 'axios';
import { handleExpiredSession } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== 'undefined' &&
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      localStorage.getItem('token') &&
      !String(error.config?.url ?? '').includes('/auth/login')
    ) {
      const isSessionReplaced = error.response?.data?.message === 'SESSION_REPLACED';
      handleExpiredSession({
        alertMessage: isSessionReplaced
          ? '您的账号已在其他设备登录，当前会话已失效。'
          : window.location.pathname.startsWith('/room/')
            ? '登录状态已过期，请重新登录后继续牌局。'
            : undefined,
        returnTo:
          !isSessionReplaced && window.location.pathname.startsWith('/room/')
            ? window.location.pathname
            : undefined,
      });
    }

    return Promise.reject(error);
  },
);

export default api;
