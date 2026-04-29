import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

export type TokenGetter = () => string | null | Promise<string | null>;

/**
 * 创建 API 客户端。
 * @param baseURL  后端地址（web 传 NEXT_PUBLIC_API_URL，mobile 传 Expo 环境变量）
 * @param getToken 获取当前 token 的函数（平台自行实现：web 用 localStorage，mobile 用 SecureStore）
 */
export function createApiClient(
  baseURL: string,
  getToken?: TokenGetter,
): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (getToken) {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
  );

  return client;
}
