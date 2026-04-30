"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { NextRouter } from "next/router";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { showSystemMessage } from "@/lib/system-message";
import { SearchingOverlay } from "@/components/lobby/searching-overlay";
import { PasswordDialog } from "@/components/lobby/password-dialog";
import { UserDropdown } from "@/components/lobby/user-dropdown";
import { RoomCard } from "@/components/lobby/room-card";

/* ---------- Quick Match Dialog ---------- */

const TIERS = [
  {
    id: "MICRO",
    label: "Micro",
    blinds: "5/10",
    minChips: 100,
    seats: 6,
    emoji: "🌱",
  },
  {
    id: "LOW",
    label: "Low",
    blinds: "10/20",
    minChips: 200,
    seats: 6,
    emoji: "💚",
  },
  {
    id: "MEDIUM",
    label: "Medium",
    blinds: "25/50",
    minChips: 500,
    seats: 9,
    emoji: "💛",
  },
  {
    id: "HIGH",
    label: "High",
    blinds: "50/100",
    minChips: 1000,
    seats: 9,
    emoji: "🔶",
  },
  {
    id: "PREMIUM",
    label: "Premium",
    blinds: "100/200",
    minChips: 2000,
    seats: 6,
    emoji: "💎",
  },
] as const;

const ROOM_TABS: { id: string; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ring", label: "Ring" },
  { id: "tournament", label: "Tournament" },
  { id: "favorites", label: "⭐" },
];

type QuickMatchTier = (typeof TIERS)[number]["id"];

interface QuickMatchDialogProps {
  currentChips: number;
  onClose: () => void;
  onMatch: (tier: QuickMatchTier) => void;
}

function QuickMatchDialog({
  currentChips,
  onClose,
  onMatch,
}: QuickMatchDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(10,20,14,0.99) 0%, rgba(5,11,8,1) 100%)",
          border: "1px solid rgba(16,185,129,0.3)",
          boxShadow:
            "0 0 60px rgba(16,185,129,0.08), 0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* Title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚡</span>
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "rgba(52,211,153,0.6)" }}
            >
              {t("lobby.quickMatch")}
            </p>
            <h2
              className="text-xl font-black tracking-wide"
              style={{ color: "#6ee7b7" }}
            >
              {t("lobby.selectTier")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          {TIERS.map((tier) => {
            const affordable = currentChips >= tier.minChips;
            return (
              <button
                key={tier.id}
                disabled={!affordable}
                onClick={() => onMatch(tier.id)}
                className="w-full rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all duration-150 text-left"
                style={{
                  background: affordable
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(255,255,255,0.01)",
                  border: affordable
                    ? "1px solid rgba(52,211,153,0.2)"
                    : "1px solid rgba(255,255,255,0.06)",
                  opacity: affordable ? 1 : 0.4,
                  cursor: affordable ? "pointer" : "not-allowed",
                }}
                onMouseEnter={(e) => {
                  if (affordable)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(16,185,129,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (affordable)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.04)";
                }}
              >
                <span className="text-2xl leading-none">{tier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-black text-base tracking-wide"
                      style={{ color: affordable ? "#d1fae5" : "#6b7280" }}
                    >
                      {t(
                        `lobby.tier${tier.id.charAt(0) + tier.id.slice(1).toLowerCase()}`,
                      ) || tier.label}
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "rgba(245,158,11,0.75)" }}
                    >
                      {t("lobby.tierBlinds", { blinds: tier.blinds })}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    <span
                      className="text-[11px]"
                      style={{ color: "rgba(156,163,175,0.7)" }}
                    >
                      {t("lobby.tierMinChips", {
                        amount: tier.minChips.toLocaleString(),
                      })}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "rgba(156,163,175,0.7)" }}
                    >
                      {t("lobby.tierMaxSeats", { seats: tier.seats })}
                    </span>
                  </div>
                </div>
                {affordable && (
                  <span className="text-emerald-400 text-sm font-bold">→</span>
                )}
              </button>
            );
          })}
        </div>

        <p
          className="text-[10px] text-center"
          style={{ color: "rgba(107,114,128,0.6)" }}
        >
          {t("lobby.quickMatchDesc")}
        </p>
      </div>
    </div>
  );
}

/* ---------- 创建房间弹窗 ---------- */
interface CreateRoomForm {
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  password: string;
  isAnonymous: boolean;
}

const DEFAULT_FORM: CreateRoomForm = {
  name: "",
  blindSmall: 10,
  blindBig: 20,
  maxPlayers: 9,
  minBuyIn: 20,
  password: "",
  isAnonymous: false,
};

interface CreateRoomDialogProps {
  onClose: () => void;
  onCreate: (form: CreateRoomForm) => Promise<void>;
}

function CreateRoomDialog({ onClose, onCreate }: CreateRoomDialogProps) {
  const [form, setForm] = useState<CreateRoomForm>({
    ...DEFAULT_FORM,
    name: `Table ${((typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Date.now()) % 1000) + 1}`,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CreateRoomForm, string>>
  >({});
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = t("lobby.createDialog.nameRequired");
    if (form.name.trim().length > 30)
      errs.name = t("lobby.createDialog.nameTooLong");
    if (!Number.isFinite(form.blindSmall) || form.blindSmall < 1)
      errs.blindSmall = t("lobby.createDialog.sbMin");
    if (!Number.isFinite(form.blindBig) || form.blindBig < form.blindSmall * 2)
      errs.blindBig = t("lobby.createDialog.bbMin");
    if (!Number.isFinite(form.minBuyIn) || form.minBuyIn < form.blindBig)
      errs.minBuyIn = t("lobby.createDialog.minBuyInMin", {
        amount: form.blindBig,
      });
    if (form.maxPlayers < 2 || form.maxPlayers > 9)
      errs.maxPlayers = t("lobby.createDialog.seatsRange");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onCreate(form);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(234,179,8,0.25)",
    color: "#fff",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    outline: "none",
    width: "100%",
    fontSize: "0.875rem",
  } as React.CSSProperties;

  const labelStyle = {
    display: "block",
    fontSize: "0.6rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "rgba(245,158,11,0.6)",
    marginBottom: "0.375rem",
    fontWeight: 700,
  };

  const errorStyle = {
    fontSize: "0.7rem",
    color: "rgba(248,113,113,0.9)",
    marginTop: "0.25rem",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.98) 0%, rgba(6,12,9,0.99) 100%)",
          border: "1px solid rgba(234,179,8,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white text-lg tracking-wide">
            {t("lobby.createDialog.title")}
          </h2>
          <button
            onClick={onClose}
            style={{
              color: "rgba(156,163,175,0.6)",
              fontSize: "1.25rem",
              lineHeight: 1,
            }}
            className="hover:text-white transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="h-px" style={{ background: "rgba(234,179,8,0.12)" }} />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room name */}
          <div>
            <label style={labelStyle}>{t("lobby.createDialog.roomName")}</label>
            <input
              type="text"
              maxLength={30}
              style={fieldStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("lobby.createDialog.namePlaceholder")}
            />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>

          {/* Blinds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>
                {t("lobby.createDialog.smallBlind")}
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                style={fieldStyle}
                value={form.blindSmall}
                onChange={(e) => {
                  const sb = Number(e.target.value);
                  setForm((f) => {
                    const newBb = f.blindBig < sb * 2 ? sb * 2 : f.blindBig;
                    return {
                      ...f,
                      blindSmall: sb,
                      blindBig: newBb,
                      minBuyIn: f.minBuyIn === f.blindBig ? newBb : f.minBuyIn,
                    };
                  });
                }}
              />
              {errors.blindSmall && (
                <p style={errorStyle}>{errors.blindSmall}</p>
              )}
            </div>
            <div>
              <label style={labelStyle}>
                {t("lobby.createDialog.bigBlind")}
              </label>
              <input
                type="number"
                min={form.blindSmall * 2}
                max={99999}
                style={fieldStyle}
                value={form.blindBig}
                onChange={(e) => {
                  const bb = Number(e.target.value);
                  setForm((f) => ({
                    ...f,
                    blindBig: bb,
                    // auto-update minBuyIn only if it was tracking the old bb value
                    minBuyIn: f.minBuyIn === f.blindBig ? bb : f.minBuyIn,
                  }));
                }}
              />
              {errors.blindBig && <p style={errorStyle}>{errors.blindBig}</p>}
            </div>
          </div>

          {/* Max players */}
          <div>
            <label style={labelStyle}>{t("lobby.createDialog.maxSeats")}</label>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-1 sm:gap-2">
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, maxPlayers: n }))}
                  className="h-8 sm:h-9 rounded-lg text-[10px] sm:text-xs font-bold transition-all truncate overflow-hidden min-w-0"
                  style={{
                    background:
                      form.maxPlayers === n
                        ? "rgba(245,158,11,0.9)"
                        : "rgba(255,255,255,0.06)",
                    color:
                      form.maxPlayers === n ? "#000" : "rgba(255,255,255,0.6)",
                    border:
                      form.maxPlayers === n
                        ? "none"
                        : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            {errors.maxPlayers && <p style={errorStyle}>{errors.maxPlayers}</p>}
          </div>

          {/* Preview */}
          <div>
            <label style={labelStyle}>{t("lobby.createDialog.minBuyIn")}</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={form.blindBig}
                max={9999999}
                placeholder={String(form.blindBig)}
                style={{ ...fieldStyle, flex: 1 }}
                value={form.minBuyIn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minBuyIn: Number(e.target.value) }))
                }
              />
              {form.minBuyIn !== form.blindBig && (
                <button
                  type="button"
                  title={t("lobby.createDialog.minBuyInResetTitle")}
                  onClick={() =>
                    setForm((f) => ({ ...f, minBuyIn: f.blindBig }))
                  }
                  className="shrink-0 h-9 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(234,179,8,0.2)",
                    color: "rgba(245,158,11,0.75)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("lobby.createDialog.minBuyInReset")}
                </button>
              )}
            </div>
            <p
              style={{
                fontSize: "0.68rem",
                color: "rgba(156,163,175,0.55)",
                marginTop: "0.25rem",
              }}
            >
              {t("lobby.createDialog.minBuyInHint", { amount: form.blindBig })}
            </p>
            {errors.minBuyIn && <p style={errorStyle}>{errors.minBuyIn}</p>}
          </div>

          {/* Anonymous mode toggle */}
          <div>
            <label style={labelStyle}>
              {t("lobby.createDialog.anonymous")}
            </label>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, isAnonymous: !f.isAnonymous }))
              }
              className="w-full h-9 rounded-lg flex items-center justify-between px-3 text-sm transition-all"
              style={{
                background: form.isAnonymous
                  ? "rgba(168,85,247,0.15)"
                  : "rgba(0,0,0,0.35)",
                border: form.isAnonymous
                  ? "1px solid rgba(168,85,247,0.4)"
                  : "1px solid rgba(234,179,8,0.18)",
              }}
            >
              <span
                className="font-medium"
                style={{
                  color: form.isAnonymous ? "#c084fc" : "rgba(255,255,255,0.6)",
                }}
              >
                🎭 {t("lobby.createDialog.anonymousLabel")}
              </span>
              <div
                className="w-10 h-5 rounded-full transition-all duration-200 relative"
                style={{
                  background: form.isAnonymous
                    ? "rgba(168,85,247,0.6)"
                    : "rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                  style={{
                    background: form.isAnonymous
                      ? "#c084fc"
                      : "rgba(255,255,255,0.4)",
                    left: form.isAnonymous ? "22px" : "2px",
                  }}
                />
              </div>
            </button>
            <p
              style={{
                fontSize: "0.68rem",
                color: "rgba(156,163,175,0.55)",
                marginTop: "0.25rem",
              }}
            >
              {t("lobby.createDialog.anonymousHint")}
            </p>
          </div>

          {/* Password (optional) */}
          <div>
            <label style={labelStyle}>{t("lobby.createDialog.password")}</label>
            <input
              type="password"
              className="w-full h-9 rounded-lg px-3 text-sm text-white"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(234,179,8,0.18)",
                outline: "none",
              }}
              placeholder={t("lobby.createDialog.passwordPlaceholder")}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              autoComplete="new-password"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10 rounded-lg font-bold tracking-wide text-xs uppercase"
              style={{
                background: "transparent",
                border: "1px solid rgba(234,179,8,0.2)",
                color: "rgba(245,158,11,0.6)",
              }}
              onClick={onClose}
              disabled={submitting}
            >
              {t("lobby.createDialog.cancelBtn")}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 rounded-lg font-black tracking-widest text-xs uppercase"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                color: "#000",
                border: "none",
                opacity: submitting ? 0.7 : 1,
              }}
              disabled={submitting}
            >
              {submitting
                ? t("lobby.createDialog.creating")
                : t("lobby.createDialog.createBtn")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Share Room Dialog (P2-ROOM-UX-005) ---------- */

interface ShareRoomDialogProps {
  room: { id: string; name: string };
  onClose: () => void;
}

function ShareRoomDialog({ room, onClose }: ShareRoomDialogProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const roomUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${room.id}`
      : `/room/${room.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
    } catch { /* ignore */ }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{
          background: "linear-gradient(160deg, rgba(12,22,16,0.98) 0%, rgba(6,12,9,0.99) 100%)",
          border: "1px solid rgba(234,179,8,0.2)",
          boxShadow: "0 0 30px rgba(234,179,8,0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white tracking-wide">
            {t("lobby.shareRoom")}
          </h2>
          <button
            onClick={onClose}
            className="text-xl opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>

        {/* Room name */}
        <p className="text-sm" style={{ color: "rgba(200,200,200,0.7)" }}>
          {room.name}
        </p>

        {/* QR Code */}
        <div className="flex justify-center py-2">
          <div
            className="p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.95)" }}
          >
            <QRCodeSVG
              value={roomUrl}
              size={160}
              bgColor="transparent"
              fgColor="#000"
              level="M"
            />
          </div>
        </div>

        {/* Room URL */}
        <div className="space-y-2">
          <p
            className="text-xs opacity-60"
            style={{ color: "rgba(200,200,200,0.6)" }}
          >
            {t("lobby.roomLink")}
          </p>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs break-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(200,200,200,0.8)",
            }}
          >
            {roomUrl}
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopyLink}
          className="w-full h-10 rounded-lg text-sm font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
            color: "#000",
            boxShadow: "0 0 15px rgba(245,158,11,0.2)",
          }}
        >
          {t("lobby.copyLink")}
        </button>
      </div>
    </div>
  );
}

/* ---------- Prize Modal for Tournament Rooms ---------- */

interface PrizeModalProps {
  room: Room;
  onClose: () => void;
  onJoin: (roomId: string) => void;
}

function PrizeModal({ room, onClose, onJoin }: PrizeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  if (!room.isTournament || !room.tournamentConfig) return null;

  const { buyin, maxPlayers, prizeDistribution } = room.tournamentConfig;
  const totalPrize = buyin * maxPlayers;
  const firstPrize = Math.floor((totalPrize * prizeDistribution[0]) / 100);
  const secondPrize = Math.floor((totalPrize * prizeDistribution[1]) / 100);
  const thirdPrize = Math.floor((totalPrize * prizeDistribution[2]) / 100);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.99) 0%, rgba(6,12,9,1) 100%)",
          border: "1px solid rgba(245,158,11,0.3)",
          boxShadow:
            "0 0 60px rgba(245,158,11,0.1), 0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              {t("lobby.tournament.sng")}
            </p>
            <h2 className="text-lg font-black tracking-wide text-white">
              {room.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Buyin & Total Prize */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <p
              className="text-[10px] uppercase tracking-widest mb-1"
              style={{ color: "rgba(245,158,11,0.5)" }}
            >
              Buy-in
            </p>
            <p className="text-base font-black text-amber-400">
              {buyin.toLocaleString()}
            </p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <p
              className="text-[10px] uppercase tracking-widest mb-1"
              style={{ color: "rgba(52,211,153,0.5)" }}
            >
              Total Prize
            </p>
            <p className="text-base font-black" style={{ color: "#6ee7b7" }}>
              {totalPrize.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Prize Breakdown */}
        <div className="space-y-2">
          <p
            className="text-[10px] uppercase tracking-widest text-center"
            style={{ color: "rgba(245,158,11,0.5)" }}
          >
            Prize Distribution
          </p>
          <div className="space-y-1.5">
            {/* 1st */}
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background: "rgba(252,211,77,0.08)",
                border: "1px solid rgba(252,211,77,0.15)",
              }}
            >
              <span className="text-lg">🥇</span>
              <span
                className="flex-1 text-xs font-bold"
                style={{ color: "#fcd34d" }}
              >
                1st
              </span>
              <span className="text-xs font-bold" style={{ color: "#fcd34d" }}>
                {prizeDistribution[0]}%
              </span>
              <span className="text-sm font-black text-white">
                {firstPrize.toLocaleString()}
              </span>
            </div>
            {/* 2nd */}
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background: "rgba(209,213,219,0.06)",
                border: "1px solid rgba(209,213,219,0.12)",
              }}
            >
              <span className="text-lg">🥈</span>
              <span
                className="flex-1 text-xs font-bold"
                style={{ color: "#d1d5db" }}
              >
                2nd
              </span>
              <span className="text-xs font-bold" style={{ color: "#d1d5db" }}>
                {prizeDistribution[1]}%
              </span>
              <span className="text-sm font-black text-white">
                {secondPrize.toLocaleString()}
              </span>
            </div>
            {/* 3rd */}
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background: "rgba(180,83,9,0.08)",
                border: "1px solid rgba(180,83,9,0.15)",
              }}
            >
              <span className="text-lg">🥉</span>
              <span
                className="flex-1 text-xs font-bold"
                style={{ color: "#b45309" }}
              >
                3rd
              </span>
              <span className="text-xs font-bold" style={{ color: "#b45309" }}>
                {prizeDistribution[2]}%
              </span>
              <span className="text-sm font-black text-white">
                {thirdPrize.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="text-center">
          <p className="text-[10px]" style={{ color: "rgba(156,163,175,0.5)" }}>
            {maxPlayers} players max
          </p>
        </div>

        {/* Join Button */}
        <button
          onClick={() => onJoin(room.id)}
          className="w-full h-11 rounded-xl font-black tracking-widest text-sm uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
            color: "#000",
            boxShadow: "0 0 20px rgba(245,158,11,0.25)",
          }}
        >
          {t("lobby.tournament.joinTournament")}
        </button>
      </div>
    </div>
  );
}

interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  isPrivate?: boolean;
  isClubOnly?: boolean;
  clubId?: string;
  tier?: "MICRO" | "LOW" | "MEDIUM" | "HIGH" | "PREMIUM";
  isTournament?: boolean;
  isAnonymous?: boolean;
  tournamentConfig?: {
    type: "SNG";
    buyin: number;
    maxPlayers: number;
    prizeDistribution: [number, number, number];
  };
}

interface RoomStatus {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
  gameState?: "waiting" | "playing";
}

interface CurrentRoomResponse {
  roomId: string | null;
  isMatchmaking: boolean;
  isInActiveGame: boolean;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStatusMap, setRoomStatusMap] = useState<
    Record<string, RoomStatus>
  >({});
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogCount, setCreateDialogCount] = useState(0);
  const [showQuickMatchDialog, setShowQuickMatchDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // P2-ROOM-UX-004: Favorite rooms
  const [favoriteRoomIds, setFavoriteRoomIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("favoriteRoomIds");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggleFavorite = useCallback((roomId: string) => {
    setFavoriteRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      try {
        localStorage.setItem("favoriteRoomIds", JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // P2-ROOM-UX-005: Share dialog state
  const [shareRoom, setShareRoom] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<
    "ALL" | "MICRO" | "LOW" | "MEDIUM" | "HIGH" | "PREMIUM"
  >("ALL");
  const [roomTab, setRoomTab] = useState<"all" | "ring" | "tournament" | "favorites">(
    "all",
  );
  const [myClubIds, setMyClubIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"players" | "blinds" | "name">(
    "players",
  );
  const isSearchingRef = useRef(false);
  const [passwordDialog, setPasswordDialog] = useState<{
    roomId: string;
    roomName: string;
  } | null>(null);
  const [prizeModalRoom, setPrizeModalRoom] = useState<Room | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    const fetchRooms = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const [currentRoomRes, roomsRes, profileRes, clubsRes] =
          await Promise.all([
            api.get<CurrentRoomResponse>("/tables/me/current-room"),
            api.get("/rooms"),
            api.get("/auth/profile"),
            api
              .get<{ data: { id: string }[] }>("/clubs/me/clubs")
              .catch(() => ({ data: { data: [] } })),
          ]);

        if (cancelled) return;

        // Extract user's club IDs
        const clubIds = Array.isArray(clubsRes.data?.data)
          ? clubsRes.data.data.map((c: { id: string }) => c.id)
          : [];
        setMyClubIds(clubIds);

        if (currentRoomRes.data?.roomId) {
          // Always leave any current room when returning to the lobby.
          await api.post("/tables/me/leave-room").catch(() => {});
        }

        // Support both paginated {data,total} and flat array responses
        const rawRooms = Array.isArray(roomsRes.data)
          ? roomsRes.data
          : Array.isArray(roomsRes.data?.data)
            ? roomsRes.data.data
            : [];
        const roomList: Room[] = rawRooms;
        if (cancelled) return;
        setRooms(roomList);
        setCurrentBalance(
          typeof profileRes.data?.coinBalance === "number" &&
            Number.isFinite(profileRes.data.coinBalance)
            ? profileRes.data.coinBalance
            : 0,
        );
        setNickname(
          typeof profileRes.data?.nickname === "string"
            ? profileRes.data.nickname
            : "",
        );
        setUserId(
          typeof profileRes.data?.id === "string" ? profileRes.data.id : "",
        );
        setUserAvatar(
          typeof profileRes.data?.avatar === "string"
            ? profileRes.data.avatar
            : null,
        );

        const statusEntries = await Promise.all(
          roomList.map(async (room) => {
            const { data } = await api.get(`/tables/rooms/${room.id}/status`);
            return [room.id, data] as const;
          }),
        );

        if (!cancelled) {
          // Merge API results with any real-time WS updates that arrived during
          // the fetch — WS updates win for rooms already updated in-flight.
          setRoomStatusMap((prev) => ({
            ...Object.fromEntries(statusEntries),
            ...prev,
          }));
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("token");
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Disconnect any existing stale socket before creating a new one.
    // This ensures clean state when navigating back from /room/[id].
    disconnectSocket();

    const socket = getSocket(token);

    const onRoomCreated = (room: Room) => {
      setRooms((prevRooms) => {
        if (prevRooms.some((existingRoom) => existingRoom.id === room.id)) {
          return prevRooms;
        }
        return [room, ...prevRooms];
      });

      setRoomStatusMap((prevMap) => ({
        ...prevMap,
        [room.id]: {
          roomId: room.id,
          currentPlayers: 0,
          maxPlayers: room.maxPlayers,
          isFull: false,
        },
      }));
    };

    const onRoomDissolved = (payload: { id: string }) => {
      setRooms((prevRooms) => prevRooms.filter((r) => r.id !== payload.id));
      setRoomStatusMap((prevMap) => {
        const next = { ...prevMap };
        delete next[payload.id];
        return next;
      });
    };

    const onRoomStatusUpdated = (status: RoomStatus) => {
      setRoomStatusMap((prevMap) => ({
        ...prevMap,
        [status.roomId]: status,
      }));
    };

    socket.on("room_created", onRoomCreated);
    socket.on("room_dissolved", onRoomDissolved);
    socket.on("room_status_updated", onRoomStatusUpdated);

    const onMatchFound = (payload: { roomId: string }) => {
      if (!isSearchingRef.current) return;
      isSearchingRef.current = false;
      setIsSearching(false);
      router.push(`/room/${payload.roomId}`);
    };

    const onMatchError = async (payload: {
      message: string;
      required?: number;
    }) => {
      if (!isSearchingRef.current) return;
      isSearchingRef.current = false;
      setIsSearching(false);
      let msg = t("lobby.matchError");
      if (payload.message === "insufficient_chips") {
        msg = t("lobby.matchErrorInsufficientChips", {
          amount: payload.required ?? 0,
        });
      } else if (payload.message === "already_in_room") {
        msg = t("lobby.matchErrorAlreadyInRoom");
      }
      await showSystemMessage({ title: t("lobby.quickMatch"), message: msg });
    };

    socket.on("match_found", onMatchFound);
    socket.on("match_error", onMatchError);

    fetchRooms();

    // Backup: refresh rooms on any route change back to /rooms
    const handleRouteChange = () => {
      if (pathname === "/rooms") {
        fetchRooms();
      }
    };
    (router as unknown as NextRouter).events?.on(
      "routeChangeComplete",
      handleRouteChange,
    );

    return () => {
      cancelled = true;
      socket.off("room_created", onRoomCreated);
      socket.off("room_dissolved", onRoomDissolved);
      socket.off("room_status_updated", onRoomStatusUpdated);
      socket.off("match_found", onMatchFound);
      socket.off("match_error", onMatchError);
      disconnectSocket();
    };
  }, [router, pathname, t]);

  const handleJoinRoom = async (roomId: string) => {
    const room = rooms.find((entry) => entry.id === roomId);
    const minimumRequiredBalance = room
      ? room.minBuyIn > 0
        ? room.minBuyIn
        : room.blindBig
      : 0;
    if (currentBalance < minimumRequiredBalance) {
      await showSystemMessage({
        title: t("room.insufficientBalance"),
        message: t("room.insufficientBalanceMsg", {
          amount: minimumRequiredBalance,
        }),
      });
      return;
    }

    if (room?.isPrivate) {
      setPasswordDialog({ roomId, roomName: room.name });
      return;
    }

    if (room?.isTournament) {
      setPrizeModalRoom(room);
      return;
    }

    router.push(`/room/${roomId}`);
  };

  const handlePasswordConfirm = (password: string) => {
    if (!passwordDialog) return;
    if (password.trim()) {
      sessionStorage.setItem(
        `room-password:${passwordDialog.roomId}`,
        password.trim(),
      );
    }
    router.push(`/room/${passwordDialog.roomId}`);
    setPasswordDialog(null);
  };

  const handleCreateRoom = async (form: CreateRoomForm) => {
    try {
      const { data } = await api.post("/rooms", {
        name: form.name.trim(),
        blindSmall: form.blindSmall,
        blindBig: form.blindBig,
        maxPlayers: form.maxPlayers,
        minBuyIn: form.minBuyIn,
        isAnonymous: form.isAnonymous,
        password: form.password.trim() || undefined,
      });
      setCreateDialogCount((c) => c + 1);
      setShowCreateDialog(false);
      const pwd = form.password.trim();
      if (pwd) {
        sessionStorage.setItem(`room-password:${data.id}`, pwd);
      }
      router.push(`/room/${data.id}`);
    } catch (error) {
      console.error("Failed to create room", error);
      await showSystemMessage({
        title: t("lobby.createDialog.createFailed"),
        message: t("lobby.createDialog.createFailedMsg"),
      });
    }
  };

  const handleQuickMatch = (tier: QuickMatchTier) => {
    setShowQuickMatchDialog(false);
    isSearchingRef.current = true;
    setIsSearching(true);
    const token = localStorage.getItem("token");
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("quick_match", { tier });
  };

  const handleCancelSearch = () => {
    isSearchingRef.current = false;
    setIsSearching(false);
  };

  // Compute filtered + sorted room list
  const filteredRooms = rooms
    .filter((room) => {
      // Filter out club-exclusive rooms the user is not a member of
      if (room.isClubOnly && room.clubId && !myClubIds.includes(room.clubId)) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (q && !room.name.toLowerCase().includes(q)) return false;
      if (tierFilter !== "ALL") {
        // Derive tier from blindSmall value (heuristic — mirrors TIERS definitions)
        const tierOfRoom =
          room.blindSmall <= 5
            ? "MICRO"
            : room.blindSmall <= 10
              ? "LOW"
              : room.blindSmall <= 25
                ? "MEDIUM"
                : room.blindSmall <= 50
                  ? "HIGH"
                  : "PREMIUM";
        if (tierOfRoom !== tierFilter) return false;
      }
      if (roomTab === "ring" && room.isTournament) return false;
      if (roomTab === "tournament" && !room.isTournament) return false;
      if (roomTab === "favorites" && !favoriteRoomIds.has(room.id)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "players") {
        const aPlayers = roomStatusMap[a.id]?.currentPlayers ?? 0;
        const bPlayers = roomStatusMap[b.id]?.currentPlayers ?? 0;
        return bPlayers - aPlayers; // desc
      }
      if (sortBy === "blinds") {
        return (b.blindBig ?? 0) - (a.blindBig ?? 0); // desc
      }
      return a.name.localeCompare(b.name); // asc
    });

  if (loading) {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
        }}
      >
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Header skeleton */}
          <div
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6"
            style={{ borderBottom: "1px solid rgba(234,179,8,0.15)" }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg animate-pulse"
                  style={{ background: "rgba(245,158,11,0.15)" }}
                />
                <div
                  className="w-32 h-8 rounded animate-pulse"
                  style={{ background: "rgba(245,158,11,0.1)" }}
                />
              </div>
              <div
                className="w-24 h-3 rounded animate-pulse ml-13"
                style={{ background: "rgba(245,158,11,0.06)" }}
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-24 h-10 rounded-lg animate-pulse"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
              ))}
              <div
                className="w-10 h-10 rounded-lg animate-pulse"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
            </div>
          </div>

          {/* Filter bar skeleton */}
          <div className="flex flex-wrap items-center gap-3 pb-2">
            <div
              className="w-48 h-9 rounded-lg animate-pulse"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-16 h-8 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
              ))}
            </div>
            <div
              className="w-20 h-8 rounded-lg animate-pulse"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>

          {/* Room card grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{
                  background:
                    "linear-gradient(160deg, rgba(12,22,16,0.95) 0%, rgba(6,12,9,0.98) 100%)",
                  border: "1px solid rgba(234,179,8,0.15)",
                  animationDelay: `${i * 100}ms`,
                }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div
                      className="w-3/4 h-5 rounded animate-pulse"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    />
                    <div
                      className="w-1/2 h-3 rounded animate-pulse"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>
                  <div
                    className="w-14 h-7 rounded-lg animate-pulse"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  />
                </div>

                {/* Progress bar skeleton */}
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{
                      width: "60%",
                      background: "rgba(255,255,255,0.1)",
                    }}
                  />
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between">
                  <div
                    className="w-1/3 h-3 rounded animate-pulse"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  />
                  <div
                    className="w-16 h-7 rounded-lg animate-pulse"
                    style={{ background: "rgba(245,158,11,0.12)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
      }}
    >
      {showCreateDialog && (
        <CreateRoomDialog
          key={createDialogCount}
          onClose={() => {
            setCreateDialogCount((c) => c + 1);
            // Defer hide so the key prop update (which remounts with fresh form) takes effect first
            setTimeout(() => setShowCreateDialog(false), 0);
          }}
          onCreate={handleCreateRoom}
        />
      )}

      {showQuickMatchDialog && (
        <QuickMatchDialog
          currentChips={currentBalance}
          onClose={() => setShowQuickMatchDialog(false)}
          onMatch={handleQuickMatch}
        />
      )}

      {isSearching && <SearchingOverlay onCancel={handleCancelSearch} />}

      {/* Password dialog for private rooms */}
      {passwordDialog && (
        <PasswordDialog
          roomName={passwordDialog.roomName}
          onClose={() => setPasswordDialog(null)}
          onConfirm={handlePasswordConfirm}
        />
      )}

      {/* Prize modal for tournament rooms */}
      {prizeModalRoom && (
        <PrizeModal
          room={prizeModalRoom}
          onClose={() => setPrizeModalRoom(null)}
          onJoin={(roomId) => {
            setPrizeModalRoom(null);
            router.push(`/room/${roomId}`);
          }}
        />
      )}

      {/* P2-ROOM-UX-005: Share room dialog */}
      {shareRoom && (
        <ShareRoomDialog
          room={shareRoom}
          onClose={() => setShareRoom(null)}
        />
      )}

      {/* Background decorative suit symbols */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-8 left-8 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-12">
          ♠
        </span>
        <span className="absolute top-20 right-10 text-[12rem] font-serif opacity-[0.03] text-yellow-400 rotate-6">
          ♥
        </span>
        <span className="absolute bottom-16 left-16 text-[11rem] font-serif opacity-[0.03] text-yellow-400 rotate-3">
          ♦
        </span>
        <span className="absolute bottom-8 right-8 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-6">
          ♣
        </span>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <header
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6"
          style={{ borderBottom: "1px solid rgba(234,179,8,0.15)" }}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🎰</span>
              <h1
                className="text-3xl font-black tracking-[0.08em] uppercase"
                style={{
                  background:
                    "linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t("lobby.title")}
              </h1>
            </div>
            <p
              className="text-[10px] tracking-[0.3em] uppercase"
              style={{ color: "rgba(245,158,11,0.45)" }}
            >
              {t("lobby.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Match button */}
            <Button
              onClick={() => setShowQuickMatchDialog(true)}
              className="font-bold tracking-widest text-xs uppercase h-10 px-3 sm:px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #065f46 0%, #047857 40%, #10b981 100%)",
                color: "#ecfdf5",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(16,185,129,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              ⚡{" "}
              <span className="hidden sm:inline">
                {t("lobby.quickMatchBtn")}
              </span>
              <span className="sm:hidden">
                {t("lobby.quickMatchBtn").split(" ")[0]}
              </span>
            </Button>

            {/* Create Table button */}
            <Button
              onClick={() => {
                setCreateDialogCount((c) => c + 1);
                setShowCreateDialog(true);
              }}
              className="font-bold tracking-widest text-xs uppercase h-10 px-3 sm:px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                color: "#000",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(245,158,11,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              <span className="hidden sm:inline">{t("lobby.createTable")}</span>
              <span className="sm:hidden">
                + {t("lobby.createTable").split(" ").pop()}
              </span>
            </Button>

            {/* Deposit button — sm+ only */}
            <Button
              onClick={() => router.push("/deposit")}
              className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #4ade80 100%)",
                color: "#ecfdf5",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(74,222,128,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              💰 {t("common.deposit")}
            </Button>

            {/* Withdraw button — sm+ only */}
            <Button
              onClick={() => router.push("/withdraw")}
              className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #3b0a0a 0%, #5f1111 40%, #dc2626 100%)",
                color: "#fecaca",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(220,38,38,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              💸 {t("common.withdraw")}
            </Button>

            {/* Friends button — sm+ only */}
            <Button
              onClick={() => router.push("/friends")}
              className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-4 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #0c2d3d 0%, #0e3d52 40%, #38bdf8 100%)",
                color: "#e0f2fe",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(56,189,248,0.15), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              👥 {t("friends.title")}
            </Button>

            <UserDropdown
              nickname={nickname}
              userId={userId}
              avatar={userAvatar}
              onLogout={async () => {
                try {
                  await api.post("/auth/logout");
                } catch {
                  /* best-effort */
                }
                disconnectSocket();
                localStorage.removeItem("token");
                router.push("/login");
              }}
            />
          </div>
        </header>

        {/* Search + Filter bar */}
        <div className="flex flex-wrap items-center gap-3 pb-2">
          {/* Search input */}
          <div className="relative flex-1 min-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-40 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder={t("lobby.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(234,179,8,0.18)",
              }}
            />
          </div>

          {/* Room type tab navigation */}
          <div className="flex items-center gap-1.5">
            {ROOM_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoomTab(tab.id as "all" | "ring" | "tournament" | "favorites")}
                className="h-8 px-4 rounded-full text-xs font-bold tracking-wide transition-all"
                style={{
                  background:
                    roomTab === tab.id
                      ? "rgba(234,179,8,0.85)"
                      : "rgba(255,255,255,0.06)",
                  color: roomTab === tab.id ? "#000" : "rgba(200,200,200,0.7)",
                  border:
                    roomTab === tab.id
                      ? "none"
                      : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {tab.id === "all"
                  ? t("lobby.tabAll")
                  : tab.id === "ring"
                    ? t("lobby.tabRing")
                    : tab.id === "tournament"
                      ? t("lobby.tabTournament")
                      : tab.id === "favorites"
                        ? t("lobby.tabFavorites")
                        : tab.label}
              </button>
            ))}
          </div>

          {/* Tier filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              ["ALL", "MICRO", "LOW", "MEDIUM", "HIGH", "PREMIUM"] as const
            ).map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className="h-8 px-3 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all"
                style={{
                  background:
                    tierFilter === tier
                      ? "rgba(234,179,8,0.85)"
                      : "rgba(255,255,255,0.06)",
                  color: tierFilter === tier ? "#000" : "rgba(200,200,200,0.7)",
                  border:
                    tierFilter === tier
                      ? "none"
                      : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {tier === "ALL"
                  ? t("lobby.filterAll")
                  : tier.charAt(0) + tier.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-widest opacity-40"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              {t("lobby.sortBy")}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 px-2 rounded-lg text-xs font-bold text-white outline-none cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(234,179,8,0.18)",
              }}
            >
              <option value="players">{t("lobby.sortPlayers")}</option>
              <option value="blinds">{t("lobby.sortBlinds")}</option>
              <option value="name">{t("lobby.sortName")}</option>
            </select>
          </div>

          {/* Result count */}
          <span
            className="text-xs opacity-40"
            style={{ color: "rgba(245,158,11,0.6)" }}
          >
            {t("lobby.resultCount", { count: filteredRooms.length })}
          </span>
        </div>

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="text-center py-16 space-y-5">
            <div className="text-6xl opacity-30">🂠</div>
            <p
              className="text-base tracking-widest uppercase font-semibold"
              style={{ color: "rgba(245,158,11,0.4)" }}
            >
              {t("lobby.noTables")}
            </p>
            <p className="text-sm" style={{ color: "rgba(107,114,128,0.6)" }}>
              {t("lobby.noTablesHint")}
            </p>
            {/* P2-ROOM-UX-003: CTA buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setCreateDialogCount((c) => c + 1);
                  setShowCreateDialog(true);
                }}
                className="h-10 px-6 rounded-lg text-sm font-bold tracking-wide transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                  color: "#000",
                  boxShadow: "0 0 15px rgba(245,158,11,0.2)",
                }}
              >
                {t("lobby.createTable")}
              </button>
              <button
                onClick={() => {
                  setRoomTab("all");
                  setSearchQuery("");
                  setTierFilter("ALL");
                }}
                className="h-10 px-6 rounded-lg text-sm font-bold tracking-wide transition-all hover:opacity-80 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(200,200,200,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {t("lobby.quickMatch")}
              </button>
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl opacity-20">🔍</div>
            <p
              className="text-sm font-semibold tracking-wide"
              style={{ color: "rgba(245,158,11,0.4)" }}
            >
              {t("lobby.noMatch")}
            </p>
            {/* P2-ROOM-UX-003: Clear filters CTA */}
            <button
              onClick={() => {
                setSearchQuery("");
                setTierFilter("ALL");
              }}
              className="h-9 px-5 rounded-lg text-xs font-bold tracking-wide transition-all hover:opacity-80 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(200,200,200,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {t("lobby.clearFilters")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                status={roomStatusMap[room.id] ?? null}
                currentBalance={currentBalance}
                onJoin={handleJoinRoom}
                isFavorite={favoriteRoomIds.has(room.id)}
                onToggleFavorite={toggleFavorite}
                onShare={setShareRoom}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
