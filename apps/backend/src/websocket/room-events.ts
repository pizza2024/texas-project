import { EventEmitter } from 'events';

export interface RoomCreatedPayload {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  isPrivate: boolean;
}

export interface RoomDissolvedPayload {
  id: string;
}

export interface RoomStatusUpdatedPayload {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
}

export const ROOM_CREATED_EVENT = 'room.created';
export const ROOM_DISSOLVED_EVENT = 'room.dissolved';
export const ROOM_STATUS_UPDATED_EVENT = 'room.status_updated';

export const roomEvents = new EventEmitter();
