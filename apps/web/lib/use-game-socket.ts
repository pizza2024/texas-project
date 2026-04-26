'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@texas/shared';
import type { EmojiFlight } from '@/app/room/[id]/components/EmojiOverlay';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface UseGameSocketOptions {
  socket: GameSocket | null;
  roomId: string;
  myUserId: string;
  onEmojiReaction?: (reaction: { userId: string; emoji: string }) => void;
}

export interface UseGameSocketReturn {
  /** Emit an emoji reaction for the current player */
  emitEmoji: (emoji: string) => void;
  /** Get current active emoji flights */
  activeFlights: EmojiFlight[];
  /** Remove a completed flight */
  removeFlight: (id: string) => void;
}

/** Allowed emoji set — must match EmojiReactionSchema */
export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥'] as const;
export type AllowedEmoji = typeof ALLOWED_EMOJIS[number];

let _flightIdCounter = 0;
function nextFlightId() {
  return `emoji-flight-${++_flightIdCounter}`;
}

export function useGameSocket({
  socket,
  roomId,
  myUserId,
  onEmojiReaction,
}: UseGameSocketOptions): UseGameSocketReturn {
  const flightsRef = useRef<EmojiFlight[]>([]);

  // Listen for incoming emoji-reaction events from other players
  useEffect(() => {
    if (!socket) return;

    const handler = (data: { roomId: string; userId: string; emoji: string }) => {
      if (data.roomId !== roomId) return;
      if (data.userId === myUserId) return; // Don't display our own — already shown locally

      // Validate emoji
      if (!ALLOWED_EMOJIS.includes(data.emoji as AllowedEmoji)) return;

      const seatIndex = -1; // server would ideally send seat position; fallback below
      const flight: EmojiFlight = {
        id: nextFlightId(),
        emoji: data.emoji,
        seatIndex,
        delay: 0,
      };

      flightsRef.current = [...flightsRef.current, flight];
    };

    socket.on('emoji-reaction', handler);
    return () => {
      socket.off('emoji-reaction', handler);
    };
  }, [socket, roomId, myUserId, onEmojiReaction]);

  const emitEmoji = useCallback(
    (emoji: string) => {
      if (!socket || !ALLOWED_EMOJIS.includes(emoji as AllowedEmoji)) return;
      socket.emit('emoji-reaction', { roomId, emoji });
    },
    [socket, roomId],
  );

  const activeFlights = flightsRef.current;

  const removeFlight = useCallback((id: string) => {
    flightsRef.current = flightsRef.current.filter((f) => f.id !== id);
  }, []);

  return { emitEmoji, activeFlights, removeFlight };
}
