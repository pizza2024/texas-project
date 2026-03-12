import { EventEmitter } from 'events';

export interface RoomCreatedPayload {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
}

export interface RoomDissolvedPayload {
  id: string;
}

export const ROOM_CREATED_EVENT = 'room.created';
export const ROOM_DISSOLVED_EVENT = 'room.dissolved';

export const roomEvents = new EventEmitter();
