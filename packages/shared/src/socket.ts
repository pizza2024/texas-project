import { io, type Socket } from 'socket.io-client';
import type {
  ForceLogoutPayload,
  MatchFoundPayload,
  MatchErrorPayload,
  DepositConfirmedPayload,
  TableState,
} from './types/game';

export type { ForceLogoutPayload, MatchFoundPayload, MatchErrorPayload, DepositConfirmedPayload };

// ── 事件类型映射（供 TypeScript 严格校验） ───────────────────────────────────

export interface ServerToClientEvents {
  force_logout: (data: ForceLogoutPayload) => void;
  rejoin_available: (data: { roomId: string }) => void;
  room_created: (data: { id: string; name: string; blindSmall: number; blindBig: number; maxPlayers: number; minBuyIn: number }) => void;
  room_dissolved: (data: { id: string }) => void;
  room_status_updated: (data: { roomId: string; currentPlayers: number; maxPlayers: number; isFull: boolean }) => void;
  room_update: (data: TableState) => void;
  already_in_room: (data: { roomId: string }) => void;
  wrong_password: (data: { roomId: string }) => void;
  insufficient_balance: (data: { roomId: string; balance: number; minimumRequiredBalance: number }) => void;
  room_full: (data: { roomId: string }) => void;
  left_room: (data: { roomId: string; dissolved: boolean }) => void;
  match_found: (data: MatchFoundPayload) => void;
  match_error: (data: MatchErrorPayload) => void;
  /** 充值到账通知 */
  deposit_confirmed: (data: DepositConfirmedPayload) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { roomId: string; password?: string; buyIn?: number }) => void;
  leave_room: (data: { roomId: string }) => void;
  player_ready: (data: { roomId: string }) => void;
  player_action: (data: { roomId: string; action: string; amount?: number }) => void;
  quick_match: (data: { tier: 'MICRO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' }) => void;
  show_cards: (data: { roomId: string }) => void;
}

// ── 连接管理 ─────────────────────────────────────────────────────────────────

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let socketToken: string | null = null;

type Handler<T> = ((data: T) => void) | null;

let forceLogoutHandler: Handler<ForceLogoutPayload> = null;
let rejoinAvailableHandler: Handler<{ roomId: string }> = null;
let depositConfirmedHandler: Handler<DepositConfirmedPayload> = null;

export function setForceLogoutHandler(h: (data: ForceLogoutPayload) => void) {
  forceLogoutHandler = h;
}

export function setRejoinAvailableHandler(h: (data: { roomId: string }) => void) {
  rejoinAvailableHandler = h;
}

export function setDepositConfirmedHandler(h: (data: DepositConfirmedPayload) => void) {
  depositConfirmedHandler = h;
}

export function getSocket(
  serverUrl: string,
  token: string,
): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket || socketToken !== token) {
    if (socket) socket.disconnect();

    socket = io(serverUrl, {
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });
    socketToken = token;

    socket.on('force_logout', (data) => forceLogoutHandler?.(data));
    socket.on('rejoin_available', (data) => rejoinAvailableHandler?.(data));
    socket.on('deposit_confirmed', (data) => depositConfirmedHandler?.(data));
  } else if (socket && !socket.connected) {
    // Zombie socket: token unchanged but socket disconnected (e.g. mobile OS closed WS).
    // Force immediate reconnect without waiting for socket.io backoff.
    socket.connect();
  }

  // Detect page coming back to foreground on mobile browsers (Safari/Chrome freeze JS threads
  // while app is backgrounded, pausing socket.io's own reconnect timers).
  if (typeof document !== 'undefined' && socket) {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket && !socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
