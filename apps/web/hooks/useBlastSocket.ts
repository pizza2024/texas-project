import { useEffect, useCallback, useRef } from "react";
import { socket } from "@texas/shared/socket";
import type { Socket } from "socket.io-client";

export interface BlastGameStartedPayload {
  tableId: string;
  endsAt: number;
  initialChips: number;
}

export interface BlastGameEndedPayload {
  rankings: Array<{ playerId: string; rank: number; prize: number }>;
  multiplier: number;
}

export interface BlastPlayerForfeitedPayload {
  forfeitedPlayerId: string;
  remainingPlayers: string[];
}

export interface UseBlastSocketOptions {
  roomId: string;
  userId: string;
  onGameStarted?: (payload: BlastGameStartedPayload) => void;
  onGameEnded?: (payload: BlastGameEndedPayload) => void;
  onPlayerForfeited?: (payload: BlastPlayerForfeitedPayload) => void;
}

export function useBlastSocket({
  roomId,
  userId,
  onGameStarted,
  onGameEnded,
  onPlayerForfeited,
}: UseBlastSocketOptions) {
  const onGameStartedRef = useRef(onGameStarted);
  const onGameEndedRef = useRef(onGameEnded);
  const onPlayerForfeitedRef = useRef(onPlayerForfeited);

  // Sync refs
  useEffect(() => {
    onGameStartedRef.current = onGameStarted;
  }, [onGameStarted]);

  useEffect(() => {
    onGameEndedRef.current = onGameEnded;
  }, [onGameEnded]);

  useEffect(() => {
    onPlayerForfeitedRef.current = onPlayerForfeited;
  }, [onPlayerForfeited]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const s: Socket = socket; // singleton from @texas/shared/socket

    const handleGameStarted = (payload: BlastGameStartedPayload) => {
      onGameStartedRef.current?.(payload);
    };

    const handleGameEnded = (payload: BlastGameEndedPayload) => {
      onGameEndedRef.current?.(payload);
    };

    const handlePlayerForfeited = (payload: BlastPlayerForfeitedPayload) => {
      onPlayerForfeitedRef.current?.(payload);
    };

    s.on("blast_game_started", handleGameStarted);
    s.on("blast_game_ended", handleGameEnded);
    s.on("blast_player_forfeited", handlePlayerForfeited);

    return () => {
      s.off("blast_game_started", handleGameStarted);
      s.off("blast_game_ended", handleGameEnded);
      s.off("blast_player_forfeited", handlePlayerForfeited);
    };
  }, [roomId, userId]);

  const emitJoinBlast = useCallback((lobbyId: string) => {
    socket.emit("join-blast-lobby", { lobbyId, userId });
  }, [userId]);

  const emitLeaveBlast = useCallback((lobbyId: string) => {
    socket.emit("leave-blast-lobby", { lobbyId, userId });
  }, [userId]);

  return { emitJoinBlast, emitLeaveBlast };
}
