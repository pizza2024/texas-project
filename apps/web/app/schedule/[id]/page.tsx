"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { CountdownTimer } from "../components/CountdownTimer";
import type { ScheduleEntry } from "../components/TournamentCard";

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
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
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const statusConfig: Record<
  string,
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
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  BTC: {
    label: "BTC — Beat the Clock",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.35)",
    text: "#eab308",
  },
  SNG: {
    label: "SNG — Sit & Go",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    text: "#3b82f6",
  },
  MTT: {
    label: "MTT — Multi-Table",
    bg: "rgba(168, 85, 247, 0.12)",
    border: "rgba(168, 85, 247, 0.35)",
    text: "#a855f7",
  },
};

export default function TournamentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [tournament, setTournament] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    api
      .get(`/tournament-schedule/${id}`)
      .then((res) => setTournament(res.data))
      .catch(() => setError("Tournament not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={pageBg}>
        <div
          className="w-10 h-10 border-2 border-t-green-500 rounded-full animate-spin"
          style={{
            borderColor: "rgba(34,197,94,0.2)",
            borderTopColor: "#22c55e",
          }}
        />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={pageBg}>
        <p className="text-red-400 mb-4">{error || "Tournament not found"}</p>
        <Link
          href="/schedule"
          className="px-4 py-2 rounded-xl border border-green-800/40 text-green-400 text-sm hover:bg-green-900/20 transition-colors"
        >
          Back to Schedule
        </Link>
      </div>
    );
  }

  const sc = statusConfig[tournament.status] ?? statusConfig.SCHEDULED;
  const tc = typeConfig[tournament.type] ?? typeConfig.SNG;
  const prize = tournament.prizeDistribution;
  const canRegister =
    tournament.status === "SCHEDULED" || tournament.status === "RUNNING";

  return (
    <div className="min-h-screen" style={pageBg}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-green-900/30 backdrop-blur-md"
        style={{ background: "rgba(6, 14, 16, 0.9)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/schedule"
              className="text-gray-400 hover:text-white transition-colors text-xl"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Tournament Details</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Type + Status Row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span
            className="px-3 py-1 rounded-lg text-sm font-bold"
            style={{
              background: tc.bg,
              border: `1px solid ${tc.border}`,
              color: tc.text,
            }}
          >
            {tc.label}
          </span>
          <span
            className="px-3 py-1 rounded-lg text-sm font-semibold"
            style={{
              background: sc.bg,
              border: `1px solid ${sc.border}`,
              color: sc.text,
            }}
          >
            {sc.label}
          </span>
          {tournament.isGuarantee && (
            <span
              className="px-3 py-1 rounded-lg text-sm font-bold"
              style={{
                background: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                color: '#f97316',
              }}
            >
              GTD
            </span>
          )}
        </div>

        {/* Tournament Name */}
        <h2 className="text-3xl font-bold text-white mb-6">
          {tournament.name}
        </h2>

        {/* Countdown (if scheduled) */}
        {tournament.status === "SCHEDULED" &&
          tournament.scheduledStartTime && (
            <div
              className="rounded-2xl border border-yellow-900/30 p-5 mb-6 text-center"
              style={{ background: "rgba(234, 179, 8, 0.05)" }}
            >
              <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
                Starts In
              </p>
              <CountdownTimer
                targetTime={tournament.scheduledStartTime}
                className="text-2xl"
              />
              <p className="text-gray-400 text-sm mt-2">
                {formatTime(tournament.scheduledStartTime)}
              </p>
            </div>
          )}

        {/* Info Cards */}
        <div
          className="rounded-2xl border border-green-900/30 p-5 mb-6"
          style={{ background: "rgba(13, 40, 24, 0.4)" }}
        >
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Buy-in", value: `${formatChips(tournament.buyin)} chips`, color: "text-yellow-400" },
              { label: "Players", value: `${tournament.registeredCount ?? 0} / ${tournament.maxPlayers}` },
              {
                label: "Small Blind",
                value: `${formatChips(tournament.smallBlind)}`,
              },
              {
                label: "Big Blind",
                value: `${formatChips(tournament.smallBlind * 2)}`,
              },
              {
                label: "Total Prize",
                value: `${formatChips(tournament.totalPrize)} chips`,
                color: "text-green-400",
              },
              {
                label: "Clock Interval",
                value: tournament.clockIntervalSeconds
                  ? `${tournament.clockIntervalSeconds}s`
                  : "N/A",
              },
              {
                label: "Start Time",
                value: formatTime(tournament.scheduledStartTime),
              },
            ].map(({ label, value, color = "text-white" }) => (
              <div key={label}>
                <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">
                  {label}
                </p>
                <p className={`font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Prize Distribution */}
        <div
          className="rounded-2xl border border-green-900/30 p-5 mb-6"
          style={{ background: "rgba(13, 40, 24, 0.4)" }}
        >
          <h3 className="text-white font-semibold mb-4">Prize Distribution</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { place: "🥇 1st Place", pct: prize[0] },
              { place: "🥈 2nd Place", pct: prize[1] },
              { place: "🥉 3rd Place", pct: prize[2] },
            ].map(({ place, pct }) => (
              <div
                key={place}
                className="rounded-xl border p-4 text-center"
                style={{
                  background: "rgba(234, 179, 8, 0.06)",
                  borderColor: "rgba(234, 179, 8, 0.2)",
                }}
              >
                <p className="text-gray-400 text-sm mb-1">{place}</p>
                <p className="text-yellow-400 text-xl font-bold">{pct}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Register Button */}
        {canRegister && (
          <button
            className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
            }}
          >
            Register for Tournament
          </button>
        )}

        {/* Created timestamp */}
        <p className="text-gray-600 text-xs text-center mt-6">
          Created {formatTime(tournament.createdAt)}
        </p>
      </div>
    </div>
  );
}
