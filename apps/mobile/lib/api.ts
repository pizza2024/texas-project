import { createApiClient } from "@texas/shared";
import { getStoredToken } from "./auth";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

// Debug: 打印 API URL
console.log("🔧 [API] BASE_URL:", BASE_URL);
console.log("🔧 [API] EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL);

const api = createApiClient(BASE_URL, () => getStoredToken());

export default api;
