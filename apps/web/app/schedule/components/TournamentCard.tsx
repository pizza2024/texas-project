"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer } from "./CountdownTimer";
import { RegistrationModal } from "./RegistrationModal";

// DTO types matching backend tournament-schedule controller
export type TournamentType = "BTC" | "SNG" | "MTT";
export type TournamentScheduleStatus =
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELLED";

export interface ScheduleEntry {
  id: string;
  name: string;
  type: TournamentType;
  buyin: number;
  maxPlayers: number;
  smallBlind: number;
  clockIntervalSeconds: number;
  scheduledStartTime: string | null;
  prizeDistribution: readonly [number, number, number];
  status: TournamentScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

type Status = TournamentScheduleStatus;

const statusConfig: Record<
  Status,
  { label: string; bg: string; border: string; text: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    text: "#3b82f6",
  },
  RUNNING: {
    label: "Live",
    bg: "rgba(34, 197, 94, 0.12)",
    border: "rgba(34, 197, 94, 0.35)",
    text: "#22c55e",
  },
  COMPLETED: {
    label: "Completed",
    bg: "rgba(107, 114, 128, 0.12)",
    border: "rgba(107, 114, 128, 0.35)",
    text: "#6b7280",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.35)",
    text: "#ef4444",
  },
};

const typeConfig: Record<
  TournamentType,
  { label: string; bg: string; border: string; text: string }
> = {
  BTC: {
    label: "BTC",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.35)",
    text: "#eab308",
  },
  SNG: {
    label: "SNG",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    text: "#3b82f6",
  },
  MTT: {
    label: "MTT",
    bg: "rgba(168, 85, 247, 0.12)",
    border: "rgba(168, 85, 247, 0.35)",
    text: "#a855f7",
  },
};

function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "ASAP";
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

interface TournamentCardProps {
  tournament: ScheduleEntry;
  isRegistered?: boolean;
  onRegistered?: () => void;
}

export function TournamentCard({
  tournament,
  isRegistered = false,
  onRegistered,
}: TournamentCardProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const sc = statusConfig[tournament.status];
  const tc = typeConfig[tournament.type];

  const canRegister =
    tournament.status === "SCHEDULED" || tournament.status === "RUNNING";

  const prize = tournament.prizeDistribution;

  return (
    <>
      <div
        className="rounded-2xl border p-5 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
        style={{
          background: "rgba(13, 40, 24, 0.6)",
          borderColor: "rgba(34, 197, 94, 0.2)",
        }}
        onClick={() => router.push(`/schedule/${tournament.id}`)}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type badge */}
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text }}
            >
              {tc.label}
            </span>
            {/* Status badge */}
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}
            >
              {sc.label}
            </span>
            {isRegistered && (
              <span
                className="px-2 py-0.5 rounded text-xs font-semibold"
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.35)",
                  color: "#22c55e",
                }}
              >
                Registered
              </span>
            )}
          </div>
        </div>

        {/* Tournament Name */}
        <h3 className="text-white font-semibold text-lg mb-3 leading-tight">
          {tournament.name}
        </h3>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
          <div>
            <span className="text-gray-400">Buy-in: </span>
            <span className="text-yellow-400 font-semibold">
              {formatChips(tournament.buyin)} chips
            </span>
          </div>
          <div>
            <span className="text-gray-400">Players: </span>
            <span className="text-white font-medium">
              {tournament.maxPlayers}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Blinds: </span>
            <span className="text-white font-medium">
              {formatChips(tournament.smallBlind)}/
              {formatChips(tournament.smallBlind * 2)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Prize: </span>
            <span className="text-white font-medium">
              {prize[0]}% / {prize[1]}% / {prize[2]}%
            </span>
          </div>
        </div>

        {/* Start Time + Countdown */}
        <div className="flex items-center justify-between pt-3 border-t border-green-900/30">
          <div>
            <span className="text-gray-400 text-xs">Start: </span>
            <span className="text-gray-300 text-xs">
              {formatTime(tournament.scheduledStartTime)}
            </span>
          </div>

          {tournament.status === "SCHEDULED" &&
            tournament.scheduledStartTime && (
              <CountdownTimer
                targetTime={tournament.scheduledStartTime}
                className="text-xs"
              />
            )}
        </div>

        {/* Register CTA */}
        {canRegister && !isRegistered && (
          <button
            className="mt-3 w-full py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "white",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowModal(true);
            }}
          >
            Register
          </button>
        )}
      </div>

      {showModal && (
        <RegistrationModal
          tournament={tournament}
          onClose={() => setShowModal(false)}
          onRegistered={() => {
            setShowModal(false);
            onRegistered?.();
          }}
        />
      )}
    </>
  );
}
