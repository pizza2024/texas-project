export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  role: string;
  status: string;
  coinBalance: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  password?: string;
  status: string;
  isMatchmaking: boolean;
  tier?: string;
  createdAt: string;
  tables?: Table[];
}

export interface Table {
  id: string;
  roomId: string;
  state: string;
  stateSnapshot?: string;
  snapshotUpdatedAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  createdAt: string;
  user?: Pick<User, "id" | "nickname" | "username">;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  amountChips: number;
  amountUsdt: number;
  toAddress: string;
  fromAddress?: string;
  status: "PENDING" | "PROCESSING" | "CONFIRMED" | "FAILED";
  txHash?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  user?: Pick<User, "id" | "username" | "nickname" | "avatar">;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  detail?: string;
  createdAt: string;
  admin?: Pick<User, "id" | "nickname" | "username">;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SystemStatus {
  uptime: number;
  memoryUsed: number;
  memoryTotal: number;
  nodeVersion: string;
  platform: string;
  maintenanceMode: boolean;
}

export interface OverviewStats {
  totalUsers: number;
  activeRooms: number;
  totalHands: number;
  todayTransactions: number;
  todayFlow: number;
}

export interface RevenueItem {
  date: string;
  amount: number;
}

export interface GrowthItem {
  date: string;
  count: number;
}

export interface HotRoom {
  id: string;
  name: string;
  status: string;
  handCount: number;
}

export interface HandsStats {
  total: number;
  avgPot: number;
  totalPot: number;
}

export interface FinanceSummary {
  totalAssets: number;
  dayFlow: number;
  weekFlow: number;
  monthFlow: number;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  limit: number;
}
