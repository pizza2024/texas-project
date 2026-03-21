import { createApiClient } from '@texas/shared';
import { getStoredToken } from './auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const api = createApiClient(BASE_URL, () => getStoredToken());

export default api;
