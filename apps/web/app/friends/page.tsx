"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import api from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import {
  setFriendStatusUpdateHandler,
  setFriendRequestReceivedHandler,
} from "@/lib/socket";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import type {
  FriendStatusUpdatePayload,
  FriendRequestReceivedPayload,
} from "@texas/shared";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FriendUser {
  id: string;
  nickname: string;
  avatar: string | null;
  status: "OFFLINE" | "ONLINE" | "PLAYING";
}

interface FriendItem {
  id: string;
  status: string;
  createdAt: string;
  user: FriendUser;
}

interface FriendRequest {
  id: string;
  status: string;
  createdAt: string;
  requester: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
}

type Tab = "friends" | "requests";

/* ─── Status badge ──────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: FriendUser["status"] }) {
  const { t } = useTranslation();
  if (status === "ONLINE") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ background: "rgba(16,185,129,0.15)", color: "#4ade80" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
        {t("friends.online")}
      </span>
    );
  }
  if (status === "PLAYING") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
      >
        🎮 {t("friends.playing")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280" }}
    >
      ⚫ {t("friends.offline")}
    </span>
  );
}

/* ─── Add Friend Modal ──────────────────────────────────────────────────── */

interface AddFriendModalProps {
  onClose: () => void;
  onSent: () => void;
}

function AddFriendModal({ onClose, onSent }: AddFriendModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/friends/request", { usernameOrEmail: value.trim() });
      onSent();
      onClose();
    } catch (err: unknown) {
      const msg = (
        err as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
      if (Array.isArray(msg)) setError(msg[0]);
      else setError(msg || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

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
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(10,20,14,0.99) 0%, rgba(5,11,8,1) 100%)",
          border: "1px solid rgba(16,185,129,0.3)",
          boxShadow:
            "0 0 60px rgba(16,185,129,0.08), 0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: "rgba(52,211,153,0.6)" }}
            >
              {t("friends.addFriend")}
            </p>
            <h2
              className="text-lg font-black tracking-wide"
              style={{ color: "#6ee7b7" }}
            >
              {t("friends.addFriendTitle")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("friends.usernameOrEmail")}
          className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(52,211,153,0.25)",
          }}
          autoFocus
        />

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <Button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="w-full font-bold tracking-widest text-xs uppercase h-11 rounded-xl"
          style={{
            background: loading
              ? "rgba(16,185,129,0.3)"
              : "linear-gradient(135deg, #065f46 0%, #047857 40%, #10b981 100%)",
            color: "#ecfdf5",
            border: "none",
            boxShadow:
              "0 0 20px rgba(16,185,129,0.2), 0 4px 10px rgba(0,0,0,0.4)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("friends.sending") : t("friends.sendRequest")}
        </Button>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ──────────────────────────────────────────────── */

interface DeleteModalProps {
  friendId: string;
  friendNickname: string;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteFriendModal({
  friendId,
  friendNickname,
  onClose,
  onDeleted,
}: DeleteModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const confirm = async () => {
    setLoading(true);
    try {
      await api.delete(`/friends/${friendId}`);
      onDeleted();
      onClose();
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  };

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
        className="w-full max-w-xs rounded-2xl p-6 space-y-4"
        style={{
          background:
            "linear-gradient(160deg, rgba(20,10,10,0.99) 0%, rgba(10,5,5,1) 100%)",
          border: "1px solid rgba(248,113,113,0.3)",
          boxShadow: "0 0 40px rgba(248,113,113,0.08)",
        }}
      >
        <div className="text-center">
          <p className="text-3xl mb-2">🗑️</p>
          <h3 className="text-base font-black" style={{ color: "#fca5a5" }}>
            {t("friends.deleteConfirm")}
          </h3>
          <p className="text-xs mt-1 text-gray-500">
            {t("friends.deleteConfirmMsg")}
          </p>
        </div>
        <p className="text-center text-sm font-bold text-gray-300">
          {friendNickname}
        </p>
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "#9ca3af",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={confirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{
              background: "rgba(220,38,38,0.8)",
              color: "#fff",
              border: "none",
            }}
          >
            {loading ? "…" : t("friends.deleteFriend")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-bold shadow-xl"
      style={{
        background: "rgba(16,185,129,0.95)",
        color: "#ecfdf5",
        border: "1px solid rgba(16,185,129,0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      {message}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

export default function FriendsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    nickname: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());

  /* ── Load friends ── */
  const loadFriends = useCallback(
    async (searchQuery = "") => {
      try {
        const params: Record<string, string> = {};
        if (searchQuery) params.search = searchQuery;
        const res = await api.get<{ data: FriendItem[] }>("/friends", {
          params,
        });
        setFriends(res.data.data ?? res.data);
        setError("");
      } catch {
        setError(t("friends.loadError"));
      }
    },
    [t],
  );

  /* ── Load requests ── */
  const loadRequests = useCallback(async () => {
    try {
      const res = await api.get<{ data: FriendRequest[] }>(
        "/friends/requests",
        {
          params: { status: "PENDING" },
        },
      );
      setRequests(res.data.data ?? res.data);
      setPendingCount(
        Array.isArray(res.data.data ?? res.data)
          ? (res.data.data ?? res.data).length
          : 0,
      );
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    Promise.all([loadFriends(), loadRequests()]).finally(() =>
      setLoading(false),
    );
  }, [loadFriends, loadRequests, router]);

  /* ── Search debounce ── */
  useEffect(() => {
    const t2 = setTimeout(() => loadFriends(search), 300);
    return () => clearTimeout(t2);
  }, [search, loadFriends]);

  /* ── WebSocket handlers ── */
  useEffect(() => {
    setFriendStatusUpdateHandler((data: FriendStatusUpdatePayload) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.user.id === data.friendUserId
            ? {
                ...f,
                user: {
                  ...f.user,
                  status: data.online
                    ? ("ONLINE" as const)
                    : ("OFFLINE" as const),
                },
              }
            : f,
        ),
      );
    });

    setFriendRequestReceivedHandler((data: FriendRequestReceivedPayload) => {
      // Prepend the new request
      const newReq: FriendRequest = {
        id: data.friendId,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        requester: {
          id: data.fromUserId,
          nickname: data.fromNickname,
          avatar: data.fromAvatar,
        },
      };
      setRequests((prev) => [newReq, ...prev]);
      setPendingCount((prev) => prev + 1);
      if (tab !== "requests") {
        setToast(t("friends.requestSent"));
      }
    });
  }, [tab, t]);

  /* ── Actions ── */
  const handleAccept = async (requestId: string) => {
    setActioningIds((prev) => new Set(prev).add(requestId));
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingCount((prev) => Math.max(0, prev - 1));
      await loadFriends();
    } catch {
      /* silent */
    } finally {
      setActioningIds((prev) => {
        const s = new Set(prev);
        s.delete(requestId);
        return s;
      });
    }
  };

  const handleReject = async (requestId: string) => {
    setActioningIds((prev) => new Set(prev).add(requestId));
    try {
      await api.post(`/friends/requests/${requestId}/reject`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* silent */
    } finally {
      setActioningIds((prev) => {
        const s = new Set(prev);
        s.delete(requestId);
        return s;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/friends/${deleteTarget.id}`);
      setFriends((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setToast(t("friends.removed"));
    } catch {
      /* silent */
    }
    setDeleteTarget(null);
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen" style={pageBg}>
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="absolute top-6 left-4 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-12">
          ♠
        </span>
        <span className="absolute bottom-10 right-4 text-[11rem] font-serif opacity-[0.03] text-yellow-400 rotate-6">
          ♥
        </span>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-300 transition-colors text-lg"
            >
              ←
            </button>
            <div>
              <h1
                className="text-2xl font-black tracking-[0.08em] uppercase"
                style={{
                  background:
                    "linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t("friends.title")}
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
            style={{
              background:
                "linear-gradient(135deg, #065f46 0%, #047857 40%, #10b981 100%)",
              color: "#ecfdf5",
              boxShadow: "0 0 16px rgba(16,185,129,0.2)",
            }}
          >
            <span>＋</span>
            <span className="hidden sm:inline">{t("friends.addFriend")}</span>
          </button>
        </header>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["friends", "requests"] as Tab[]).map((t_) => (
            <button
              key={t_}
              onClick={() => setTab(t_)}
              className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                background: tab === t_ ? "rgba(16,185,129,0.2)" : "transparent",
                color: tab === t_ ? "#6ee7b7" : "#6b7280",
                border:
                  tab === t_
                    ? "1px solid rgba(16,185,129,0.3)"
                    : "1px solid transparent",
              }}
            >
              {t(`friends.tab${t_ === "friends" ? "Friends" : "Requests"}`)}
              {t_ === "requests" && pendingCount > 0 && (
                <span
                  className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black px-1"
                  style={{ background: "#f87171", color: "#fff" }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search (friends tab only) */}
        {tab === "friends" && (
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("friends.searchPlaceholder")}
              className="w-full h-10 rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <span className="text-yellow-600/60 text-sm tracking-[0.3em] animate-pulse uppercase">
              {t("common.loading")}
            </span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-10 text-red-400 text-sm">{error}</div>
        )}

        {/* Friends list */}
        {!loading && tab === "friends" && !error && (
          <>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <span className="text-5xl">👥</span>
                <p
                  className="text-sm font-bold"
                  style={{ color: "rgba(245,158,11,0.7)" }}
                >
                  {t("friends.noFriends")}
                </p>
                <p className="text-xs text-gray-600 text-center max-w-[220px]">
                  {t("friends.noFriendsHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <UserAvatar
                      userId={f.user.id}
                      avatar={f.user.avatar}
                      size={44}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-200 truncate">
                        {f.user.nickname}
                      </p>
                      <div className="mt-0.5">
                        <StatusBadge status={f.user.status} />
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setDeleteTarget({ id: f.id, nickname: f.user.nickname })
                      }
                      className="text-gray-600 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded"
                      title={t("friends.deleteFriend")}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests list */}
        {!loading && tab === "requests" && (
          <>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <span className="text-5xl">✉️</span>
                <p
                  className="text-sm font-bold"
                  style={{ color: "rgba(245,158,11,0.7)" }}
                >
                  {t("friends.noRequests")}
                </p>
                <p className="text-xs text-gray-600 text-center max-w-[220px]">
                  {t("friends.noRequestsHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <UserAvatar
                      userId={req.requester.id}
                      avatar={req.requester.avatar}
                      size={44}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-200 truncate">
                        {req.requester.nickname}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={actioningIds.has(req.id)}
                        className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={{
                          background: "rgba(16,185,129,0.8)",
                          color: "#ecfdf5",
                        }}
                      >
                        {t("friends.accept")}
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actioningIds.has(req.id)}
                        className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "#9ca3af",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {t("friends.reject")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddFriendModal
          onClose={() => setShowAddModal(false)}
          onSent={() => setToast(t("friends.requestSent"))}
        />
      )}

      {deleteTarget && (
        <DeleteFriendModal
          friendId={deleteTarget.id}
          friendNickname={deleteTarget.nickname}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDelete}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
