"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface PasswordDialogProps {
  roomName: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
}

export function PasswordDialog({
  roomName,
  onClose,
  onConfirm,
}: PasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!password.trim()) return;
    onConfirm(password.trim());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm rounded-2xl px-6 py-6"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.98) 0%, rgba(6,12,9,1) 100%)",
          border: "1px solid rgba(139,92,246,0.35)",
          boxShadow:
            "0 0 0 1px rgba(139,92,246,0.1), 0 18px 50px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl leading-none">🔒</span>
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "rgba(167,139,250,0.7)" }}
            >
              {t("lobby.private")}
            </p>
            <h2
              className="text-lg font-black tracking-wide"
              style={{ color: "#c4b5fd" }}
            >
              {roomName}
            </h2>
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(229,231,235,0.7)" }}>
          {t("lobby.passwordDialog.hint")}
        </p>
        <div className="space-y-3">
          <div>
            <label
              className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
              style={{ color: "rgba(167,139,250,0.7)" }}
            >
              {t("lobby.passwordDialog.label")}
            </label>
            <input
              type="password"
              autoFocus
              className="w-full h-10 rounded-lg px-3 text-sm text-white"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(139,92,246,0.3)"}`,
                outline: "none",
              }}
              placeholder={t("lobby.passwordDialog.placeholder")}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            {error && (
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(239,68,68,0.85)" }}
              >
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10 rounded-lg font-bold text-xs uppercase"
              style={{
                background: "transparent",
                border: "1px solid rgba(139,92,246,0.25)",
                color: "rgba(167,139,250,0.7)",
              }}
              onClick={onClose}
            >
              {t("lobby.passwordDialog.cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1 h-10 rounded-lg font-black text-xs uppercase"
              style={{
                background:
                  "linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)",
                color: "#fff",
                border: "none",
              }}
              onClick={handleConfirm}
              disabled={!password.trim()}
            >
              {t("lobby.passwordDialog.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
