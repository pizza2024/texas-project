// ── 好友状态枚举 ────────────────────────────────────────────────────────────

export type FriendStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

// ── WebSocket 事件 ───────────────────────────────────────────────────────────

export interface FriendRequestPayload {
  fromUserId: string;
  toUsernameOrEmail: string;
}

export interface FriendRequestReceivedPayload {
  friendId: string;
  fromUserId: string;
  fromNickname: string;
  fromAvatar: string | null;
}

export interface FriendRequestAcceptedPayload {
  friendId: string;
  friendNickname: string;
  friendAvatar: string | null;
}

export interface FriendStatusUpdatePayload {
  friendUserId: string;
  friendNickname: string;
  friendAvatar: string | null;
  online: boolean;
}

export interface FriendStatusChangedPayload {
  friendId: string;
  status: FriendStatus;
}
