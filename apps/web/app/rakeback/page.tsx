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
import {
  RAKEBACK_TIERS,
  type RakebackTier,
} from "@texas/shared";

type Tier = RakebackTier;

interface RakebackData {
  rakebackBalance: number;
  tier: Tier;
  rate: number;
  totalRake: number;
  minRakeForNextTier: number | null;
  rakeToNextTier: number | null;
}

interface ClaimResult {
  claimedAmount: number;
  newChipsBalance: number;
}

const tierConfig: Record<
  Tier,
  {
    bg: string;
    border: string;
    color: string;
    label: string;
    gradientFrom: string;
    gradientTo: string;
  }
> = {
  BRONZE: {
    bg: "rgba(180, 83, 9, 0.12)",
    border: "rgba(180, 83, 9, 0.35)",
    color: "#f59e0b",
    label: "Bronze",
    gradientFrom: "rgba(180, 83, 9, 0.15)",
    gradientTo: "rgba(217, 119, 6, 0.08)",
  },
  SILVER: {
    bg: "rgba(156, 163, 175, 0.12)",
    border: "rgba(156, 163, 175, 0.35)",
    color: "#d1d5db",
    label: "Silver",
    gradientFrom: "rgba(156, 163, 175, 0.15)",
    gradientTo: "rgba(209, 213, 219, 0.08)",
  },
  GOLD: {
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.35)",
    color: "#eab308",
    label: "Gold",
    gradientFrom: "rgba(234, 179, 8, 0.15)",
    gradientTo: "rgba(202, 138, 4, 0.08)",
  },
  PLATINUM: {
    bg: "rgba(229, 228, 226, 0.12)",
    border: "rgba(229, 228, 226, 0.35)",
    color: "#e5e4e2",
    label: "Platinum",
    gradientFrom: "rgba(229, 228, 226, 0.15)",
    gradientTo: "rgba(186, 186, 186, 0.08)",
  },
  DIAMOND: {
    bg: "rgba(185, 242, 255, 0.12)",
    border: "rgba(185, 242, 255, 0.35)",
    color: "#b9f2ff",
    label: "Diamond",
    gradientFrom: "rgba(185, 242, 255, 0.15)",
    gradientTo: "rgba(100, 200, 255, 0.08)",
  },
};

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

export default function RakebackPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [rakeback, setRakeback] = useState<RakebackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({ returnTo: "/rakeback" });
      return;
    }

    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? "");
    setUserId(payload?.sub ?? "");

    let cancelled = false;

    const loadRakeback = async () => {
      try {
        const { data } = await api.get<RakebackData>("/user/rakeback");
        if (!cancelled) setRakeback(data);
      } catch {
        if (!cancelled) setError(t("rakeback.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRakeback();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const handleClaim = async () => {
    if (!rakeback || rakeback.rakebackBalance <= 0) return;
    setClaiming(true);
    setClaimMessage(null);

    try {
      const res = await api.post<ClaimResult>("/user/rakeback/claim");
      const result = res.data;
      setClaimMessage({
        type: "success",
        text: t("rakeback.claimSuccess", {
          amount: result.claimedAmount.toFixed(2),
        }),
      });
      // Refresh rakeback data
      const { data: updated } = await api.get<RakebackData>("/user/rakeback");
      setRakeback(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setClaimMessage({ type: "error", text: msg ?? t("rakeback.claimError") });
    } finally {
      setClaiming(false);
    }
  };

  const tier = rakeback?.tier ?? "BRONZE";
  const cfg = tierConfig[tier];

  const progressPercent =
    rakeback && rakeback.minRakeForNextTier !== null
      ? Math.min(100, (rakeback.totalRake / rakeback.minRakeForNextTier) * 100)
      : 100;

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
          {t("rakeback.title")}
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

        {!loading && !error && rakeback && (
          <>
            {/* Rakeback Balance Card */}
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: `linear-gradient(135deg, ${cfg.gradientFrom} 0%, ${cfg.gradientTo} 100%)`,
                border: `1px solid ${cfg.border}`,
                boxShadow: `0 0 40px ${cfg.bg.replace("0.12", "0.06")}`,
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-xs uppercase tracking-widest font-semibold"
                  style={{ color: `${cfg.color}99` }}
                >
                  {t("rakeback.availableBalance")}
                </p>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{
                    background: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  {cfg.label}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span
                  className="text-5xl font-bold"
                  style={{ color: cfg.color }}
                >
                  {rakeback.rakebackBalance.toFixed(2)}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {t("rakeback.chips")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  <p
                    className="mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("rakeback.rakebackRate")}
                  </p>
                  <p className="font-bold text-lg" style={{ color: cfg.color }}>
                    {rakeback.rate}%
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  <p
                    className="mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("rakeback.totalRake")}
                  </p>
                  <p className="font-bold text-lg" style={{ color: cfg.color }}>
                    {rakeback.totalRake.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress to Next Tier */}
            {rakeback.tier !== "DIAMOND" &&
              rakeback.minRakeForNextTier !== null &&
              rakeback.rakeToNextTier !== null && (
                <div
                  className="rounded-2xl p-5 space-y-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(245,158,11,0.15)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className="text-xs uppercase tracking-widest"
                      style={{ color: "rgba(245,158,11,0.6)" }}
                    >
                      {t("rakeback.progressToNextTier")}
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {rakeback.totalRake.toFixed(0)} /{" "}
                      {rakeback.minRakeForNextTier.toFixed(0)}{" "}
                      {t("rakeback.rake")}
                    </p>
                  </div>

                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(245,158,11,0.1)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercent}%`,
                        background: `linear-gradient(90deg, ${cfg.color}99, ${cfg.color})`,
                      }}
                    />
                  </div>

                  <p
                    className="text-xs text-center"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("rakeback.rakeToNextTier", {
                      amount: rakeback.rakeToNextTier.toFixed(2),
                    })}
                  </p>
                </div>
              )}

            {/* Max Tier Reached */}
            {rakeback.tier === "DIAMOND" && (
              <div
                className="rounded-2xl p-5 text-center"
                style={{
                  background: "rgba(185,242,255,0.08)",
                  border: "1px solid rgba(185,242,255,0.25)",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#b9f2ff" }}
                >
                  {t("rakeback.maxTierReached")}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {t("rakeback.maxTierDesc")}
                </p>
              </div>
            )}

            {/* Claim Button */}
            <button
              type="button"
              onClick={() => {
                void handleClaim();
              }}
              disabled={claiming || rakeback.rakebackBalance <= 0}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide transition-all"
              style={
                claiming || rakeback.rakebackBalance <= 0
                  ? {
                      background: `${cfg.bg}`,
                      color: `${cfg.color}40`,
                      cursor: "not-allowed",
                      border: `1px solid ${cfg.border}`,
                    }
                  : {
                      background: `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
                      color: cfg.color,
                      cursor: "pointer",
                      border: `1px solid ${cfg.border}`,
                    }
              }
            >
              {claiming ? t("rakeback.claiming") : t("rakeback.claimButton")}
            </button>

            {claimMessage && (
              <div
                className="rounded-xl p-4 text-sm text-center"
                style={{
                  background:
                    claimMessage.type === "success"
                      ? "rgba(74,222,128,0.12)"
                      : "rgba(248,113,113,0.12)",
                  border: `1px solid ${claimMessage.type === "success" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
                  color:
                    claimMessage.type === "success" ? "#4ade80" : "#f87171",
                }}
              >
                {claimMessage.text}
              </div>
            )}

            {/* Tier Info */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(245,158,11,0.1)",
              }}
            >
              <p
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: "rgba(245,158,11,0.6)" }}
              >
                {t("rakeback.tierBenefits")}
              </p>
              <div className="space-y-2">
                {(["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as Tier[]).map((tierName) => {
                  const tCfg = tierConfig[tierName];
                  const sharedTier = RAKEBACK_TIERS.find((t) => t.tier === tierName)!;
                  const ranges: Record<Tier, string> = {
                    BRONZE: `0 - ${(RAKEBACK_TIERS[1].minRake - 1).toLocaleString()}`,
                    SILVER: `${RAKEBACK_TIERS[1].minRake.toLocaleString()} - ${(RAKEBACK_TIERS[2].minRake - 1).toLocaleString()}`,
                    GOLD: `${RAKEBACK_TIERS[2].minRake.toLocaleString()} - ${(RAKEBACK_TIERS[3].minRake - 1).toLocaleString()}`,
                    PLATINUM: `${RAKEBACK_TIERS[3].minRake.toLocaleString()} - ${(RAKEBACK_TIERS[4].minRake - 1).toLocaleString()}`,
                    DIAMOND: `${RAKEBACK_TIERS[4].minRake.toLocaleString()}+`,
                  };
                  const isActive = rakeback.tier === tierName;
                  return (
                    <div
                      key={tierName}
                      className="flex items-center justify-between py-2 px-3 rounded-xl"
                      style={
                        isActive
                          ? {
                              background: tCfg.bg,
                              border: `1px solid ${tCfg.border}`,
                            }
                          : {
                              background: "rgba(0,0,0,0.2)",
                              border: "1px solid transparent",
                            }
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{
                            background: tCfg.bg,
                            color: tCfg.color,
                            border: `1px solid ${tCfg.border}`,
                          }}
                        >
                          {tCfg.label}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {ranges[tierName]} {t("rakeback.rake")}
                        </span>
                      </div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: tCfg.color }}
                      >
                        {sharedTier.rate}% {t("rakeback.rakeback")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
