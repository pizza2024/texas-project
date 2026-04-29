"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { BlastCard } from "./BlastCard";
import api from "@/lib/api";
import type { BlastLobby } from "@texas/shared/types/tournament";

interface BlastLobbyListProps {
  onJoin: (lobbyId: string) => void;
  joiningLobbyId: string | null;
  buyinFilter?: number | null;
}

export function BlastLobbyList({
  onJoin,
  joiningLobbyId,
  buyinFilter,
}: BlastLobbyListProps) {
  const [lobbies, setLobbies] = useState<BlastLobby[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const fetchLobbies = async () => {
    try {
      const { data } = await api.get<BlastLobby[]>("/rooms/blast/lobbies");
      setLobbies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch blast lobbies:", error);
      setLobbies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();

    const interval = setInterval(fetchLobbies, 3000);

    return () => clearInterval(interval);
  }, []);

  const filteredLobbies = buyinFilter
    ? lobbies.filter((l) => l.buyin === buyinFilter)
    : lobbies;

  // Only show waiting lobbies
  const waitingLobbies = filteredLobbies.filter(
    (l) => l.status === "waiting" || l.status === "starting",
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin h-5 w-5 text-orange-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm" style={{ color: "rgba(156,163,175,0.7)" }}>
            {t("blast.loading")}
          </span>
        </div>
      </div>
    );
  }

  if (waitingLobbies.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <span className="text-4xl">💥</span>
        <p
          className="text-sm font-medium"
          style={{ color: "rgba(156,163,175,0.7)" }}
        >
          {t("blast.noLobbies")}
        </p>
        <p className="text-[10px]" style={{ color: "rgba(156,163,175,0.4)" }}>
          {t("blast.createFirst")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {waitingLobbies.map((lobby) => (
        <BlastCard
          key={lobby.id}
          lobby={lobby}
          onJoin={onJoin}
          isJoining={joiningLobbyId === lobby.id}
        />
      ))}
    </div>
  );
}
