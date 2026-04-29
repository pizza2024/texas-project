import { useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { getStoredToken } from "@/lib/auth";
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

export interface BlastMatchmakingTimeoutPayload {
  roomId: string;
}

export interface UseBlastSocketOptions {
  roomId: string;
  userId: string;
  onGameStarted?: (payload: BlastGameStartedPayload) => void;
  onGameEnded?: (payload: BlastGameEndedPayload) => void;
  onPlayerForfeited?: (payload: BlastPlayerForfeitedPayload) => void;
  onMatchmakingTimeout?: (payload: BlastMatchmakingTimeoutPayload) => void;
}

export function useBlastSocket({
  roomId,
  userId,
  onGameStarted,
  onGameEnded,
  onPlayerForfeited,
  onMatchmakingTimeout,
}: UseBlastSocketOptions) {
  const onGameStartedRef = useRef(onGameStarted);
  const onGameEndedRef = useRef(onGameEnded);
  const onPlayerForfeitedRef = useRef(onPlayerForfeited);
  const onMatchmakingTimeoutRef = useRef(onMatchmakingTimeout);

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
    onMatchmakingTimeoutRef.current = onMatchmakingTimeout;
  }, [onMatchmakingTimeout]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const token = getStoredToken();
    if (!token) return;
    const s: Socket = getSocket(token);

    const handleGameStarted = (payload: BlastGameStartedPayload) => {
      onGameStartedRef.current?.(payload);
    };

    const handleGameEnded = (payload: BlastGameEndedPayload) => {
      onGameEndedRef.current?.(payload);
    };

    const handlePlayerForfeited = (payload: BlastPlayerForfeitedPayload) => {
      onPlayerForfeitedRef.current?.(payload);
    };

    const handleMatchmakingTimeout = (payload: BlastMatchmakingTimeoutPayload) => {
      onMatchmakingTimeoutRef.current?.(payload);
    };

    s.on("blast_game_started", handleGameStarted);
    s.on("blast_game_ended", handleGameEnded);
    s.on("blast_player_forfeited", handlePlayerForfeited);
    s.on("matchmaking_timeout", handleMatchmakingTimeout);

    return () => {
      s.off("blast_game_started", handleGameStarted);
      s.off("blast_game_ended", handleGameEnded);
      s.off("blast_player_forfeited", handlePlayerForfeited);
      s.off("matchmaking_timeout", handleMatchmakingTimeout);
    };
  }, [roomId, userId]);

  const emitJoinBlast = useCallback(
    (lobbyId: string) => {
      const token = getStoredToken();
      if (!token) return;
      const s = getSocket(token);
      s.emit("join-blast-lobby", { lobbyId, userId });
    },
    [userId],
  );

  const emitLeaveBlast = useCallback(
    (lobbyId: string) => {
      const token = getStoredToken();
      if (!token) return;
      const s = getSocket(token);
      s.emit("leave-blast-lobby", { lobbyId, userId });
    },
    [userId],
  );

  return { emitJoinBlast, emitLeaveBlast };
}
