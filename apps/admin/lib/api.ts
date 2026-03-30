const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );
  const qs = new URLSearchParams(clean as Record<string, string>).toString();
  return qs ? `?${qs}` : "";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || `HTTP ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

// Users
export const getUsers = (params?: Record<string, any>) =>
  request<any>(`/admin/users${buildQuery(params)}`);

export const getUserById = (id: string) => request<any>(`/admin/users/${id}`);

export const updateUser = (id: string, data: any) =>
  request<any>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const banUser = (id: string) =>
  request<any>(`/admin/users/${id}/ban`, { method: "POST" });

export const unbanUser = (id: string) =>
  request<any>(`/admin/users/${id}/unban`, { method: "POST" });

export const adjustBalance = (id: string, amount: number, reason?: string) =>
  request<any>(`/admin/users/${id}/balance`, {
    method: "POST",
    body: JSON.stringify({ amount, reason }),
  });

export const getUserTransactions = (id: string, params?: Record<string, any>) =>
  request<any>(`/admin/users/${id}/transactions${buildQuery(params)}`);

// Rooms
export const getRooms = (params?: Record<string, any>) =>
  request<any>(`/admin/rooms${buildQuery(params)}`);

export const getRoomById = (id: string) => request<any>(`/admin/rooms/${id}`);

export const createRoom = (data: any) =>
  request<any>("/admin/rooms", { method: "POST", body: JSON.stringify(data) });

export const updateRoom = (id: string, data: any) =>
  request<any>(`/admin/rooms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteRoom = (id: string) =>
  request<any>(`/admin/rooms/${id}`, { method: "DELETE" });

export const toggleRoomMaintenance = (id: string) =>
  request<any>(`/admin/rooms/${id}/maintenance`, { method: "POST" });

// Finance
export const getTransactions = (params?: Record<string, any>) =>
  request<any>(`/admin/finance/transactions${buildQuery(params)}`);

export const getFinanceSummary = () => request<any>("/admin/finance/summary");

export const deposit = (userId: string, amount: number, reason?: string) =>
  request<any>("/admin/finance/deposit", {
    method: "POST",
    body: JSON.stringify({ userId, amount, reason }),
  });

export const withdraw = (userId: string, amount: number, reason?: string) =>
  request<any>("/admin/finance/withdraw", {
    method: "POST",
    body: JSON.stringify({ userId, amount, reason }),
  });

// Analytics
export const getOverview = () => request<any>("/admin/analytics/overview");
export const getUserGrowth = (days = 30) =>
  request<any>(`/admin/analytics/users?days=${days}`);
export const getRevenue = (period = "day", n = 30) =>
  request<any>(`/admin/analytics/revenue?period=${period}&n=${n}`);
export const getRoomHotList = () => request<any>("/admin/analytics/rooms");
export const getHandsStats = () => request<any>("/admin/analytics/hands");

// System
export const getSystemStatus = () => request<any>("/admin/system/status");
export const getAdminLogs = (params?: Record<string, any>) =>
  request<any>(`/admin/system/logs${buildQuery(params)}`);
export const toggleMaintenance = (enable?: boolean) =>
  request<any>("/admin/system/maintenance", {
    method: "POST",
    body: JSON.stringify({ enable }),
  });
export const sendBroadcast = (
  message: string,
  type?: "info" | "warning" | "error",
) =>
  request<any>("/admin/system/broadcast", {
    method: "POST",
    body: JSON.stringify({ message, type }),
  });

// Withdraw Management
export const getWithdrawRequests = (params?: Record<string, any>) =>
  request<any>(`/admin/withdraw/requests${buildQuery(params)}`);

export const getWithdrawRequest = (id: string) =>
  request<any>(`/admin/withdraw/${id}`);

export const processWithdraw = (
  id: string,
  action: "APPROVE" | "REJECT",
  reason?: string,
) =>
  request<any>(`/admin/withdraw/${id}/process`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
