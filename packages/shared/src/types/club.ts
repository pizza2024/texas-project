// Club roles
export type ClubRole = "OWNER" | "ADMIN" | "MEMBER";

// Club info (returned by list/detail endpoints)
export interface ClubInfo {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  ownerId: string;
  ownerNickname: string;
  memberCount: number;
  myRole?: ClubRole; // only present when user is authenticated
  createdAt: string;
}

// Club member
export interface ClubMember {
  id: string;
  userId: string;
  nickname: string;
  avatar: string | null;
  role: ClubRole;
  status: "OFFLINE" | "ONLINE" | "PLAYING";
  joinedAt: string;
}

// Club chat message
export interface ClubChatMessage {
  id: string;
  clubId: string;
  userId: string;
  nickname: string;
  avatar: string | null;
  message: string;
  createdAt: string;
}

// API response shapes
export interface ClubListResponse {
  data: ClubInfo[];
  nextCursor: string | null;
}

export interface ClubDetailResponse extends ClubInfo {
  members: ClubMember[];
}

export interface JoinClubResponse {
  id: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  joinedAt: string;
}

// WebSocket events (ClubGateway emits)
export interface ClubErrorPayload {
  code: string;
  message: string;
}

export interface ClubMemberJoinedPayload {
  clubId: string;
  userId: string;
  nickname: string;
}

export interface ClubMemberLeftPayload {
  clubId: string;
  userId: string;
}

export interface ClubMemberKickedPayload {
  clubId: string;
  kickedUserId: string;
}

export interface ClubChatMessagePayload {
  id: string;
  clubId: string;
  userId: string;
  nickname: string;
  avatar: string | null;
  message: string;
  createdAt: string;
}
