"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { BlastBuyinSelector } from "./BlastBuyinSelector";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import type { BlastLobby } from "@texas/shared/types/tournament";

interface CreateBlastDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (lobby: BlastLobby) => void;
}

export function CreateBlastDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateBlastDialogProps) {
  const [buyin, setBuyin] = useState<number>(1000);
  const [isCreating, setIsCreating] = useState(false);
  const [createdLobby, setCreatedLobby] = useState<BlastLobby | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const { data } = await api.post<BlastLobby>("/rooms/blast", { buyin });
      setCreatedLobby(data);
      onCreated(data);
      // Auto-close after a brief delay
      setTimeout(() => {
        setCreatedLobby(null);
        setIsCreating(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to create blast lobby:", error);
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setCreatedLobby(null);
      setIsCreating(false);
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(20,10,5,0.99) 0%, rgba(10,5,2,1) 100%)",
          border: "1px solid rgba(249,115,22,0.3)",
          boxShadow:
            "0 0 60px rgba(249,115,22,0.1), 0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">💥</span>
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "rgba(249,115,22,0.6)" }}
            >
              BLAST
            </p>
            <h2 className="text-lg font-black tracking-wide text-white">
              {t("blast.createLobby")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isCreating}
            style={{
              color: "rgba(156,163,175,0.6)",
              fontSize: "1.25rem",
              lineHeight: 1,
            }}
            className="ml-auto hover:text-white transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>

        {createdLobby ? (
          /* Success state */
          <div className="text-center py-4 space-y-3">
            <span className="text-4xl">✅</span>
            <div>
              <p className="text-sm font-bold text-white">
                {t("blast.lobbyCreated")}
              </p>
              <p
                className="text-[10px] mt-1"
                style={{ color: "rgba(156,163,175,0.6)" }}
              >
                ID: {createdLobby.id}
              </p>
            </div>
            <p
              className="text-[10px]"
              style={{ color: "rgba(52,211,153,0.7)" }}
            >
              {t("blast.waitingForPlayers")}
            </p>
          </div>
        ) : (
          <>
            <div
              className="h-px"
              style={{ background: "rgba(249,115,22,0.12)" }}
            />

            {/* Buyin selector */}
            <div className="space-y-3">
              <label
                className="block text-[10px] font-bold tracking-[0.1em] uppercase"
                style={{ color: "rgba(249,115,22,0.6)" }}
              >
                {t("blast.selectBuyin")}
              </label>
              <BlastBuyinSelector value={buyin} onChange={setBuyin} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 rounded-lg font-bold tracking-wide text-xs uppercase"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(249,115,22,0.2)",
                  color: "rgba(249,115,22,0.6)",
                }}
                onClick={handleClose}
                disabled={isCreating}
              >
                {t("blast.cancel")}
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 rounded-lg font-black tracking-widest text-xs uppercase"
                style={{
                  background:
                    "linear-gradient(135deg, #ea580c 0%, #f97316 30%, #fb923c 100%)",
                  color: "#000",
                  border: "none",
                  opacity: isCreating ? 0.7 : 1,
                }}
                onClick={handleCreate}
                disabled={isCreating}
                loading={isCreating}
              >
                {isCreating ? t("blast.creating") : t("blast.create")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
