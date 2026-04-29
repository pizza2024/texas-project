"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import type { BlastLobby } from "@texas/shared/types/tournament";
import { Button } from "@/components/ui/button";

interface BlastCardProps {
  lobby: BlastLobby;
  onJoin: (lobbyId: string) => void;
  isJoining: boolean;
}

function formatTimeWaiting(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

export function BlastCard({ lobby, onJoin, isJoining }: BlastCardProps) {
  const { t } = useTranslation();

  const playerCount = lobby.playerIds.length;
  const maxPlayers = lobby.maxPlayers;
  const isFull = playerCount >= maxPlayers;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
      style={{
        background:
          "linear-gradient(160deg, rgba(20,10,5,0.95) 0%, rgba(10,5,2,0.98) 100%)",
        border: isFull
          ? "1px solid rgba(248,113,113,0.2)"
          : "1px solid rgba(249,115,22,0.2)",
        boxShadow: isFull
          ? "0 0 20px rgba(248,113,113,0.05)"
          : "0 0 20px rgba(249,115,22,0.05)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">💥</span>
            <h3 className="font-black text-white text-base tracking-wide">
              BLAST
            </h3>
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(249,115,22,0.15)",
                color: "rgba(249,115,22,0.8)",
                border: "1px solid rgba(249,115,22,0.25)",
              }}
            >
              {t("blast.status.waiting")}
            </span>
          </div>
          <p
            className="text-[10px] tracking-[0.2em] uppercase mt-0.5"
            style={{ color: "rgba(249,115,22,0.5)" }}
          >
            Buy-in: {lobby.buyin.toLocaleString()} chips
          </p>
        </div>

        {/* Player count badge */}
        <div
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{
            background: isFull
              ? "rgba(239,68,68,0.15)"
              : "rgba(16,185,129,0.1)",
            color: isFull ? "rgba(248,113,113,0.9)" : "rgba(52,211,153,0.9)",
            border: isFull
              ? "1px solid rgba(239,68,68,0.2)"
              : "1px solid rgba(16,185,129,0.2)",
          }}
        >
          {playerCount}/{maxPlayers}
        </div>
      </div>

      {/* Blinds info */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px]"
          style={{ color: "rgba(156,163,175,0.6)" }}
        >
          💰{" "}
          {t("blast.blinds", {
            small: lobby.smallBlind,
            big: lobby.bigBlind,
          })}
        </span>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
        <span
          className="text-[10px]"
          style={{ color: "rgba(156,163,175,0.6)" }}
        >
          ⏱ {formatTimeWaiting(lobby.createdAt)}
        </span>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-end">
        {isFull ? (
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: "rgba(248,113,113,0.7)" }}
          >
            🔒 {t("blast.full")}
          </span>
        ) : (
          <Button
            size="sm"
            className="h-8 rounded-lg font-bold tracking-wide text-xs"
            style={{
              background:
                "linear-gradient(135deg, #ea580c 0%, #f97316 30%, #fb923c 100%)",
              color: "#000",
              boxShadow: "0 0 15px rgba(249,115,22,0.2)",
            }}
            onClick={() => onJoin(lobby.id)}
            disabled={isJoining}
            loading={isJoining}
          >
            {t("blast.join")}
          </Button>
        )}
      </div>
    </div>
  );
}
