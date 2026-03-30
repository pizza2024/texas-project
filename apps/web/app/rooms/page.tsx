"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { showSystemMessage } from "@/lib/system-message";
import { UserAvatar } from "@/components/user-avatar";

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
}

const DEFAULT_FORM: CreateRoomForm = {
  name: "",
  blindSmall: 10,
  blindBig: 20,
  maxPlayers: 9,
  minBuyIn: 20,
  password: "",
};

interface CreateRoomDialogProps {
  onClose: () => void;
  onCreate: (form: CreateRoomForm) => Promise<void>;
}

function CreateRoomDialog({ onClose, onCreate }: CreateRoomDialogProps) {
  const [form, setForm] = useState<CreateRoomForm>({
    ...DEFAULT_FORM,
    name: `Table ${Math.floor(Math.random() * 1000)}`,
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
    fontSize: "0.625rem",
    letterSpacing: "0.2em",
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
          <div className="grid grid-cols-2 gap-3">
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
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, maxPlayers: n }))}
                  className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
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

interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  isPrivate?: boolean;
}

interface RoomStatus {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStatusMap, setRoomStatusMap] = useState<
    Record<string, RoomStatus>
  >({});
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [elo, setElo] = useState<number>(1000);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQuickMatchDialog, setShowQuickMatchDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const isSearchingRef = useRef(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{
    roomId: string;
    roomName: string;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchRooms = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const [currentRoomRes, roomsRes, profileRes] = await Promise.all([
          api.get("/tables/me/current-room"),
          api.get("/rooms"),
          api.get("/auth/profile"),
        ]);

        if (currentRoomRes.data?.roomId) {
          if (currentRoomRes.data?.isMatchmaking) {
            // Silently leave stale matchmaking rooms so the user returns to the lobby cleanly.
            await api.post("/tables/me/leave-room").catch(() => {});
          } else {
            router.replace(`/room/${currentRoomRes.data.roomId}`);
            return;
          }
        }

        // Support both paginated {data,total} and flat array responses
        const rawRooms = Array.isArray(roomsRes.data)
          ? roomsRes.data
          : Array.isArray(roomsRes.data?.data)
            ? roomsRes.data.data
            : [];
        const roomList: Room[] = rawRooms;
        setRooms(roomList);
        setCurrentBalance(
          typeof profileRes.data?.coinBalance === "number" &&
            Number.isFinite(profileRes.data.coinBalance)
            ? profileRes.data.coinBalance
            : 0,
        );
        setElo(
          typeof profileRes.data?.elo === "number" ? profileRes.data.elo : 1000,
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

        setRoomStatusMap(Object.fromEntries(statusEntries));
      } catch {
        localStorage.removeItem("token");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

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
        const { [payload.id]: _, ...rest } = prevMap;
        return rest;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).events?.on("routeChangeComplete", handleRouteChange);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("room_dissolved", onRoomDissolved);
      socket.off("room_status_updated", onRoomStatusUpdated);
      socket.off("match_found", onMatchFound);
      socket.off("match_error", onMatchError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).events?.off("routeChangeComplete", handleRouteChange);
      disconnectSocket();
    };
  }, [pathname, router]);

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
      setPasswordInput("");
      setPasswordError("");
      setPasswordDialog({ roomId, roomName: room.name });
      return;
    }

    router.push(`/room/${roomId}`);
  };

  const handlePasswordJoin = () => {
    if (!passwordDialog) return;
    if (passwordInput.trim()) {
      sessionStorage.setItem(
        `room-password:${passwordDialog.roomId}`,
        passwordInput.trim(),
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
        password: form.password.trim() || undefined,
      });
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

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)",
        }}
      >
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🃏</div>
          <p
            className="text-sm tracking-[0.3em] uppercase font-semibold"
            style={{ color: "rgba(245,158,11,0.7)" }}
          >
            {t("lobby.loadingTables")}
          </p>
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
          onClose={() => setShowCreateDialog(false)}
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

      {/* Searching overlay */}
      {isSearching && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
          <div
            className="relative flex flex-col items-center gap-6 px-10 py-9 rounded-3xl"
            style={{
              background:
                "linear-gradient(160deg, rgba(12,22,16,0.99) 0%, rgba(6,12,9,1) 100%)",
              border: "1px solid rgba(234,179,8,0.3)",
              boxShadow:
                "0 0 60px rgba(234,179,8,0.08), 0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div
              className="text-5xl animate-spin"
              style={{ animationDuration: "1.5s" }}
            >
              ⚡
            </div>
            <div className="text-center space-y-1.5">
              <p
                className="text-xl font-black tracking-widest uppercase"
                style={{ color: "#fcd34d" }}
              >
                {t("lobby.searching")}
              </p>
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
            <button
              className="text-xs font-bold tracking-[0.2em] uppercase px-6 py-2.5 rounded-lg transition-colors hover:bg-white/10"
              style={{
                color: "rgba(245,158,11,0.6)",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
              onClick={handleCancelSearch}
            >
              {t("lobby.searchingCancel")}
            </button>
          </div>
        </div>
      )}

      {/* Password dialog for private rooms */}
      {passwordDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPasswordDialog(null)}
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
                  {passwordDialog.roomName}
                </h2>
              </div>
            </div>
            <p
              className="text-sm mb-4"
              style={{ color: "rgba(229,231,235,0.7)" }}
            >
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
                    border: `1px solid ${passwordError ? "rgba(239,68,68,0.5)" : "rgba(139,92,246,0.3)"}`,
                    outline: "none",
                  }}
                  placeholder={t("lobby.passwordDialog.placeholder")}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordJoin()}
                />
                {passwordError && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(239,68,68,0.85)" }}
                  >
                    {passwordError}
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
                  onClick={() => setPasswordDialog(null)}
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
                  onClick={handlePasswordJoin}
                  disabled={!passwordInput.trim()}
                >
                  {t("lobby.passwordDialog.confirm")}
                </Button>
              </div>
            </div>
          </div>
        </div>
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

          <div className="flex items-center gap-3">
            {/* Quick Match button */}
            <Button
              onClick={() => setShowQuickMatchDialog(true)}
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #065f46 0%, #047857 40%, #10b981 100%)",
                color: "#ecfdf5",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(16,185,129,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              ⚡ {t("lobby.quickMatchBtn")}
            </Button>

            {/* Create Table button */}
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                color: "#000",
                border: "none",
                boxShadow:
                  "0 0 20px rgba(245,158,11,0.2), 0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              {t("lobby.createTable")}
            </Button>

            {/* Deposit button */}
            <Button
              onClick={() => router.push("/deposit")}
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
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

            {/* Withdraw button */}
            <Button
              onClick={() => router.push("/withdraw")}
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
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

            {/* Avatar + click dropdown */}
            <div className="relative">
              {/* Click-outside overlay */}
              {showDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
              )}
              {/* Avatar circle */}
              <div
                className="cursor-pointer transition-all duration-200"
                onClick={() => setShowDropdown((v) => !v)}
                style={{
                  boxShadow: showDropdown
                    ? "0 0 22px rgba(245,158,11,0.45), 0 4px 14px rgba(0,0,0,0.45)"
                    : "0 0 10px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.4)",
                  borderRadius: "50%",
                  border: "2px solid rgba(245,158,11,0.35)",
                  transform: showDropdown ? "scale(1.06)" : "scale(1)",
                }}
              >
                <UserAvatar
                  userId={userId}
                  avatar={userAvatar}
                  size={40}
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(20,40,28,0.95) 0%, rgba(8,20,12,0.98) 100%)",
                  }}
                />
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(12,22,16,0.99) 0%, rgba(6,12,9,1) 100%)",
                    border: "1px solid rgba(234,179,8,0.22)",
                    boxShadow:
                      "0 12px 40px rgba(0,0,0,0.65), 0 0 20px rgba(234,179,8,0.06)",
                  }}
                >
                  {/* User info row */}
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(234,179,8,0.1)" }}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        userId={userId}
                        avatar={userAvatar}
                        size={32}
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(20,40,28,0.95) 0%, rgba(8,20,12,0.98) 100%)",
                          border: "1px solid rgba(245,158,11,0.35)",
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-white font-black text-sm truncate">
                          {nickname || "—"}
                        </p>
                        <p
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: "rgba(245,158,11,0.6)" }}
                        >
                          ${currentBalance.toLocaleString()}
                        </p>
                        <p
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: "rgba(52,211,153,0.7)" }}
                        >
                          ⚡ {t("lobby.eloRating")}: {elo}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm font-semibold tracking-wide flex items-center gap-3 transition-colors hover:bg-yellow-900/20"
                      style={{ color: "rgba(245,158,11,0.85)" }}
                      onClick={() => {
                        setShowDropdown(false);
                        router.push("/stats");
                      }}
                    >
                      <span>📊</span>
                      {t("common.stats")}
                    </button>
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm font-semibold tracking-wide flex items-center gap-3 transition-colors hover:bg-yellow-900/20"
                      style={{ color: "rgba(245,158,11,0.85)" }}
                      onClick={() => {
                        setShowDropdown(false);
                        router.push("/settings");
                      }}
                    >
                      <span>⚙️</span>
                      {t("common.settings")}
                    </button>
                    <div
                      className="h-px mx-4 my-1"
                      style={{ background: "rgba(234,179,8,0.1)" }}
                    />
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm font-semibold tracking-wide flex items-center gap-3 transition-colors hover:bg-red-900/20"
                      style={{ color: "rgba(248,113,113,0.75)" }}
                      onClick={async () => {
                        setShowDropdown(false);
                        try {
                          await api.post("/auth/logout");
                        } catch {
                          /* best-effort */
                        }
                        disconnectSocket();
                        localStorage.removeItem("token");
                        router.push("/login");
                      }}
                    >
                      <span>🚪</span>
                      {t("common.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="text-center py-20 space-y-4">
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
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => {
              const status = roomStatusMap[room.id];
              const current = status?.currentPlayers ?? 0;
              const max = status?.maxPlayers ?? room.maxPlayers;
              const isFull = status?.isFull ?? false;
              const fillPct = Math.round((current / max) * 100);

              return (
                <div
                  key={room.id}
                  className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)",
                    border: isFull
                      ? "1px solid rgba(239,68,68,0.25)"
                      : "1px solid rgba(234,179,8,0.2)",
                    boxShadow: isFull
                      ? "0 0 30px rgba(239,68,68,0.05), 0 8px 30px rgba(0,0,0,0.5)"
                      : "0 0 30px rgba(234,179,8,0.05), 0 8px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-black text-white tracking-wide text-base flex items-center gap-2">
                        {room.isPrivate && (
                          <span title={t("lobby.private")}>🔒</span>
                        )}
                        {room.name}
                      </h2>
                      <p
                        className="text-[10px] tracking-[0.2em] uppercase mt-0.5"
                        style={{ color: "rgba(245,158,11,0.5)" }}
                      >
                        {t("lobby.noLimitHoldem")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {room.isPrivate && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(139,92,246,0.15)",
                            color: "rgba(167,139,250,0.9)",
                            border: "1px solid rgba(139,92,246,0.25)",
                          }}
                        >
                          {t("lobby.private")}
                        </span>
                      )}
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: isFull
                            ? "rgba(239,68,68,0.15)"
                            : "rgba(34,197,94,0.12)",
                          color: isFull
                            ? "rgba(239,68,68,0.9)"
                            : "rgba(74,222,128,0.9)",
                          border: isFull
                            ? "1px solid rgba(239,68,68,0.25)"
                            : "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        {isFull ? t("lobby.full") : t("lobby.open")}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className="h-px"
                    style={{ background: "rgba(234,179,8,0.1)" }}
                  />

                  {/* Stats */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span
                        className="text-[10px] tracking-[0.2em] uppercase font-semibold"
                        style={{ color: "rgba(245,158,11,0.5)" }}
                      >
                        {t("lobby.blinds")}
                      </span>
                      <span className="font-bold text-white text-sm">
                        ${room.blindSmall}{" "}
                        <span style={{ color: "rgba(234,179,8,0.5)" }}>/</span>{" "}
                        ${room.blindBig}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span
                        className="text-[10px] tracking-[0.2em] uppercase font-semibold"
                        style={{ color: "rgba(245,158,11,0.5)" }}
                      >
                        {t("lobby.players")}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {current}
                        <span style={{ color: "rgba(234,179,8,0.4)" }}>
                          /{max}
                        </span>
                      </span>
                    </div>

                    {/* Player fill bar */}
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPct}%`,
                          background: isFull
                            ? "linear-gradient(90deg, #dc2626, #ef4444)"
                            : "linear-gradient(90deg, #b45309, #f59e0b)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Join button */}
                  <div className="pt-1">
                    {isFull ? (
                      <Button
                        className="w-full h-10 rounded-lg font-bold tracking-widest text-xs uppercase"
                        disabled
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          color: "rgba(239,68,68,0.5)",
                          border: "1px solid rgba(239,68,68,0.15)",
                        }}
                      >
                        {t("lobby.roomFull")}
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-10 rounded-lg font-black tracking-widest text-xs uppercase transition-opacity hover:opacity-90 active:scale-[0.98]"
                        style={{
                          background:
                            currentBalance < (room.minBuyIn || room.blindBig)
                              ? "rgba(127,29,29,0.88)"
                              : "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                          color:
                            currentBalance < (room.minBuyIn || room.blindBig)
                              ? "#fee2e2"
                              : "#000",
                          border:
                            currentBalance < (room.minBuyIn || room.blindBig)
                              ? "1px solid rgba(248,113,113,0.28)"
                              : "none",
                          boxShadow:
                            currentBalance < (room.minBuyIn || room.blindBig)
                              ? "0 0 16px rgba(248,113,113,0.12)"
                              : "0 0 16px rgba(245,158,11,0.2)",
                        }}
                        onClick={() => void handleJoinRoom(room.id)}
                      >
                        {currentBalance < (room.minBuyIn || room.blindBig)
                          ? t("lobby.insufficientFunds", {
                              amount: room.minBuyIn || room.blindBig,
                            })
                          : t("lobby.joinTable")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
