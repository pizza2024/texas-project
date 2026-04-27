"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  BlastLobbyList,
  CreateBlastDialog,
} from "@/components/blast";
import { BLAST_BUYINS } from "@texas/shared/types/tournament";
import api from "@/lib/api";

type FilterType = "all" | (typeof BLAST_BUYINS)[number];

export default function BlastPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const handleJoin = async (lobbyId: string) => {
    setJoiningLobbyId(lobbyId);
    try {
      await api.post(`/rooms/blast/${lobbyId}/join`);
      router.push(`/room/${lobbyId}`);
    } catch (error) {
      console.error("Failed to join blast lobby:", error);
      setJoiningLobbyId(null);
    }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: t("blast.filterAll") },
    ...BLAST_BUYINS.map((b) => ({
      id: b as FilterType,
      label: b.toLocaleString(),
    })),
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(160deg, rgba(10,5,2,1) 0%, rgba(5,2,1,1) 100%)",
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 py-4 backdrop-blur-md"
        style={{
          background: "rgba(10,5,2,0.9)",
          borderBottom: "1px solid rgba(249,115,22,0.15)",
        }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <a
              href="/rooms"
              className="text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: "rgba(156,163,175,0.7)" }}
            >
              ← {t("blast.backToRooms")}
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💥</span>
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.3em] uppercase"
                  style={{ color: "rgba(249,115,22,0.6)" }}
                >
                  BLAST
                </p>
                <h1
                  className="text-xl font-black tracking-wide"
                  style={{ color: "#f97316" }}
                >
                  {t("blast.title")}
                </h1>
              </div>
            </div>

            <Button
              size="sm"
              className="h-9 rounded-lg font-bold tracking-wide text-xs"
              style={{
                background:
                  "linear-gradient(135deg, #ea580c 0%, #f97316 30%, #fb923c 100%)",
                color: "#000",
                boxShadow: "0 0 20px rgba(249,115,22,0.25)",
              }}
              onClick={() => setShowCreateDialog(true)}
            >
              + {t("blast.createLobby")}
            </Button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {filters.map((f) => {
              const isSelected = filter === f.id;
              return (
                <button
                  key={String(f.id)}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: isSelected
                      ? "rgba(249,115,22,0.2)"
                      : "rgba(255,255,255,0.03)",
                    color: isSelected
                      ? "#f97316"
                      : "rgba(156,163,175,0.6)",
                    border: isSelected
                      ? "1px solid rgba(249,115,22,0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {f.id === "all" ? f.label : `💰 ${f.label}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <BlastLobbyList
          onJoin={handleJoin}
          joiningLobbyId={joiningLobbyId}
          buyinFilter={filter === "all" ? null : filter}
        />
      </div>

      {/* Create dialog */}
      <CreateBlastDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          // Lobby created successfully — list will auto-refresh
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
