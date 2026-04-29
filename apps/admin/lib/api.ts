import type {
  User,
  Room,
  PaginatedResponse,
  Transaction,
  AdminLog,
  SystemStatus,
  FinanceSummary,
  OverviewStats,
  RevenueItem,
  GrowthItem,
  HotRoom,
  HandsStats,
  PaginatedTransactions,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiParams {
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params?: ApiParams): string {
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
export const getUsers = (params?: ApiParams) =>
  request<PaginatedResponse<User>>(`/admin/users${buildQuery(params)}`);

export const getUserById = (id: string) => request<User>(`/admin/users/${id}`);

export const updateUser = (id: string, data: { role?: string }) =>
  request<User>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const banUser = (id: string) =>
  request<void>(`/admin/users/${id}/ban`, { method: "POST" });

export const unbanUser = (id: string) =>
  request<void>(`/admin/users/${id}/unban`, { method: "POST" });

export const adjustBalance = (id: string, amount: number, reason?: string) =>
  request<void>(`/admin/users/${id}/balance`, {
    method: "POST",
    body: JSON.stringify({ amount, reason }),
  });

export const getUserTransactions = (id: string, params?: ApiParams) =>
  request<PaginatedResponse<Transaction>>(
    `/admin/users/${id}/transactions${buildQuery(params)}`,
  );

// Rooms
export const getRooms = (params?: ApiParams) =>
  request<PaginatedResponse<Room>>(`/admin/rooms${buildQuery(params)}`);

export const getRoomById = (id: string) => request<Room>(`/admin/rooms/${id}`);

export const createRoom = (data: {
  name: string;
  blindSmall?: number;
  blindBig?: number;
  maxPlayers?: number;
  minBuyIn?: number;
  password?: string;
}) =>
  request<Room>("/admin/rooms", { method: "POST", body: JSON.stringify(data) });

export const updateRoom = (
  id: string,
  data: {
    name?: string;
    blindSmall?: number;
    blindBig?: number;
    maxPlayers?: number;
    minBuyIn?: number;
    password?: string;
  },
) =>
  request<Room>(`/admin/rooms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteRoom = (id: string) =>
  request<void>(`/admin/rooms/${id}`, { method: "DELETE" });

export const toggleRoomMaintenance = (id: string) =>
  request<Room>(`/admin/rooms/${id}/maintenance`, { method: "POST" });

// Finance
export const getTransactions = (params?: ApiParams) =>
  request<PaginatedTransactions>(
    `/admin/finance/transactions${buildQuery(params)}`,
  );

export const getFinanceSummary = () =>
  request<FinanceSummary>("/admin/finance/summary");

export const deposit = (userId: string, amount: number, reason?: string) =>
  request<void>("/admin/finance/deposit", {
    method: "POST",
    body: JSON.stringify({ userId, amount, reason }),
  });

export const withdraw = (userId: string, amount: number, reason?: string) =>
  request<void>("/admin/finance/withdraw", {
    method: "POST",
    body: JSON.stringify({ userId, amount, reason }),
  });

// Analytics
export const getOverview = () =>
  request<OverviewStats>("/admin/analytics/overview");
export const getUserGrowth = (days = 30) =>
  request<GrowthItem[]>(`/admin/analytics/users?days=${days}`);
export const getRevenue = (period = "day", n = 30) =>
  request<RevenueItem[]>(`/admin/analytics/revenue?period=${period}&n=${n}`);
export const getRoomHotList = () =>
  request<HotRoom[]>("/admin/analytics/rooms");
export const getHandsStats = () =>
  request<HandsStats>("/admin/analytics/hands");

// System
export const getSystemStatus = () =>
  request<SystemStatus>("/admin/system/status");
export const getAdminLogs = (params?: ApiParams) =>
  request<PaginatedResponse<AdminLog>>(
    `/admin/system/logs${buildQuery(params)}`,
  );
export const toggleMaintenance = (enable?: boolean) =>
  request<{ maintenanceMode: boolean }>("/admin/system/maintenance", {
    method: "POST",
    body: JSON.stringify({ enable }),
  });
export const sendBroadcast = (
  message: string,
  type?: "info" | "warning" | "error",
) =>
  request<{ connectedCount: number }>("/admin/system/broadcast", {
    method: "POST",
    body: JSON.stringify({ message, type }),
  });

// Withdraw Management
export const getWithdrawRequests = (params?: ApiParams) =>
  request<PaginatedResponse<import("./types").WithdrawRequest>>(
    `/admin/withdraw/requests${buildQuery(params)}`,
  );

export const getWithdrawRequest = (id: string) =>
  request<import("./types").WithdrawRequest>(`/admin/withdraw/${id}`);

export const processWithdraw = (
  id: string,
  action: "APPROVE" | "REJECT",
  reason?: string,
) =>
  request<void>(`/admin/withdraw/${id}/process`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
