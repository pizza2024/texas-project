"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import api from "@/lib/api";
import {
  getStoredToken,
  getTokenPayload,
  handleExpiredSession,
  isTokenExpired,
} from "@/lib/auth";
import { UserAvatar } from "@/components/user-avatar";

interface RecentHand {
  id: string;
  potSize: number;
  profit: number;
  createdAt: string;
}

interface UserStats {
  handsPlayed: number;
  handsWon: number;
  winRate: number;
  totalProfit: number;
  biggestWin: number;
  biggestLoss: number;
  recentHands: RecentHand[];
}

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function ProfitText({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const color = value >= 0 ? "#4ade80" : "#f87171";
  const sign = value >= 0 ? "+" : "";
  return (
    <span className={className} style={{ color }}>
      {sign}
      {value.toFixed(2)}
    </span>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({ returnTo: "/stats" });
      return;
    }

    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? "");
    setUserId(payload?.sub ?? "");

    let cancelled = false;

    const loadStats = async () => {
      try {
        const { data } = await api.get<UserStats>("/user/stats");
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError(t("stats.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(245,158,11,0.2)",
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/rooms")}
          className="text-sm font-medium transition-colors"
          style={{ color: "rgba(245,158,11,0.8)" }}
        >
          {t("common.backToLobby")}
        </button>

        <h1
          className="text-base font-bold tracking-widest uppercase"
          style={{ color: "#f59e0b" }}
        >
          {t("common.stats")}
        </h1>

        <div className="flex items-center gap-2">
          <UserAvatar userId={userId} size={28} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {nickname}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="text-sm" style={{ color: "rgba(245,158,11,0.6)" }}>
              {t("common.loading")}
            </span>
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Hands played / won */}
              <div
                className="rounded-2xl p-4 space-y-1"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "rgba(245,158,11,0.6)" }}
                >
                  {t("stats.handsPlayed")}
                </p>
                <p className="text-3xl font-bold" style={{ color: "#f59e0b" }}>
                  {stats.handsPlayed}
                </p>
                <p
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  {t("stats.handsWon")}：
                  <span style={{ color: "#facc15" }}>{stats.handsWon}</span>
                </p>
              </div>

              {/* Win rate */}
              <div
                className="rounded-2xl p-4 space-y-1"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "rgba(245,158,11,0.6)" }}
                >
                  {t("stats.winRate")}
                </p>
                <p className="text-3xl font-bold" style={{ color: "#facc15" }}>
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>

              {/* Total profit */}
              <div
                className="rounded-2xl p-4 space-y-1"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "rgba(245,158,11,0.6)" }}
                >
                  {t("stats.totalProfit")}
                </p>
                <ProfitText
                  value={stats.totalProfit}
                  className="text-3xl font-bold"
                />
              </div>

              {/* Biggest win / loss */}
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "rgba(245,158,11,0.6)" }}
                >
                  {t("stats.bestWorst")}
                </p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {t("stats.biggestWin")}
                    </span>
                    <ProfitText value={stats.biggestWin} />
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {t("stats.biggestLoss")}
                    </span>
                    <ProfitText value={stats.biggestLoss} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent hands */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(245,158,11,0.15)" }}
            >
              <div
                className="px-4 py-3"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  borderBottom: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <h2
                  className="text-sm font-semibold tracking-wide uppercase"
                  style={{ color: "#f59e0b" }}
                >
                  {t("stats.recentHands")}
                </h2>
              </div>

              {stats.recentHands.length === 0 ? (
                <div
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {t("stats.noHands")}
                </div>
              ) : (
                <>
                  <div
                    className="divide-y"
                    style={
                      {
                        "--tw-divide-opacity": 1,
                        borderColor: "rgba(245,158,11,0.08)",
                      } as React.CSSProperties
                    }
                  >
                    {stats.recentHands.slice(0, 10).map((hand) => (
                      <div
                        key={hand.id}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                        style={{ background: "rgba(0,0,0,0.15)" }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.45)",
                            fontSize: "0.75rem",
                          }}
                        >
                          {formatDateTime(hand.createdAt)}
                        </span>
                        <ProfitText
                          value={hand.profit}
                          className="font-medium tabular-nums"
                        />
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold"
                          style={
                            hand.profit >= 0
                              ? {
                                  background: "rgba(74,222,128,0.12)",
                                  color: "#4ade80",
                                  border: "1px solid rgba(74,222,128,0.25)",
                                }
                              : {
                                  background: "rgba(248,113,113,0.12)",
                                  color: "#f87171",
                                  border: "1px solid rgba(248,113,113,0.25)",
                                }
                          }
                        >
                          {hand.profit >= 0 ? t("stats.win") : t("stats.lose")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/hands")}
                    className="w-full py-3 text-sm font-bold text-center transition-colors"
                    style={{
                      color: "rgba(245,158,11,0.6)",
                      borderTop: "1px solid rgba(245,158,11,0.08)",
                    }}
                  >
                    {t("stats.viewFullHistory")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
