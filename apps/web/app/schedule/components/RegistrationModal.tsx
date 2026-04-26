"use client";

import { useState } from "react";
import type { ScheduleEntry } from "./TournamentCard";
import api from "@/lib/api";

interface RegistrationModalProps {
  tournament: ScheduleEntry;
  onClose: () => void;
  onRegistered: () => void;
}

function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}

export function RegistrationModal({
  tournament,
  onClose,
  onRegistered,
}: RegistrationModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prize = tournament.prizeDistribution;

  const handleRegister = async () => {
    setIsRegistering(true);
    setError(null);
    try {
      await api.post(`/tournament-schedule/${tournament.id}/register`);
      onRegistered();
    } catch {
      setError("Failed to register. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{
          background: "linear-gradient(145deg, #0d2818, #060e10)",
          borderColor: "rgba(34, 197, 94, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Tournament Registration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tournament Info */}
        <div
          className="rounded-xl border p-4 mb-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(34, 197, 94, 0.15)",
          }}
        >
          <h3 className="text-white font-semibold mb-3">{tournament.name}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Buy-in</span>
              <span className="text-yellow-400 font-semibold">
                {formatChips(tournament.buyin)} chips
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Players</span>
              <span className="text-white">{tournament.maxPlayers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Prize Pool</span>
              <span className="text-white">
                {prize[0]}% / {prize[1]}% / {prize[2]}%
              </span>
            </div>
          </div>
        </div>

        {/* Prize Breakdown */}
        <div className="mb-5">
          <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">
            Prize Distribution
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { place: "1st", pct: prize[0] },
              { place: "2nd", pct: prize[1] },
              { place: "3rd", pct: prize[2] },
            ].map(({ place, pct }) => (
              <div
                key={place}
                className="rounded-lg border p-2 text-center"
                style={{
                  background: "rgba(234, 179, 8, 0.08)",
                  borderColor: "rgba(234, 179, 8, 0.2)",
                }}
              >
                <p className="text-gray-400 text-xs">{place}</p>
                <p className="text-yellow-400 font-bold">{pct}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            disabled={isRegistering}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
            }}
          >
            {isRegistering ? "Registering..." : "Register Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
