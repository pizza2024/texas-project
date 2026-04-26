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

type MissionStatus = "ACTIVE" | "COMPLETED" | "CLAIMED" | "EXPIRED";
type MissionType = "ONE_TIME" | "DAILY" | "WEEKLY";

interface Mission {
  key: string;
  title: string;
  description: string;
  type: 'ONE_TIME' | 'DAILY' | 'WEEKLY';
  rewardChips: number;
  target: number;
  progress: number;
  status: MissionStatus;
}

interface ClaimResult {
  claimedAmount: number;
  newChipsBalance: number;
}

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

const typeConfig: Record<
  MissionType,
  {
    label: string;
    bg: string;
    border: string;
    color: string;
    gradientFrom: string;
    gradientTo: string;
    progressColor: string;
  }
> = {
  ONE_TIME: {
    label: "One-Time",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.35)",
    color: "#eab308",
    gradientFrom: "rgba(234, 179, 8, 0.12)",
    gradientTo: "rgba(202, 138, 4, 0.05)",
    progressColor: "#eab308",
  },
  DAILY: {
    label: "Daily",
    bg: "rgba(34, 197, 94, 0.12)",
    border: "rgba(34, 197, 94, 0.35)",
    color: "#22c55e",
    gradientFrom: "rgba(34, 197, 94, 0.12)",
    gradientTo: "rgba(22, 163, 74, 0.05)",
    progressColor: "#22c55e",
  },
  WEEKLY: {
    label: "Weekly",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    color: "#3b82f6",
    gradientFrom: "rgba(59, 130, 246, 0.12)",
    gradientTo: "rgba(37, 99, 235, 0.05)",
    progressColor: "#3b82f6",
  },
};

function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}

function MissionCard({
  mission,
  onClaim,
  claimingId,
}: {
  mission: Mission;
  onClaim: (key: string) => void;
  claimingId: string | null;
}) {
  const { t } = useTranslation();
  const cfg = typeConfig[mission.type];
  const progressPercent = Math.min(
    100,
    (mission.progress / mission.target) * 100,
  );
  const isComplete = mission.status === "COMPLETED";
  const isClaimed = mission.status === "CLAIMED";
  const isActive = mission.status === "ACTIVE";
  const isClaiming = claimingId === mission.key;

  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-all"
      style={{
        background: `linear-gradient(135deg, ${cfg.gradientFrom} 0%, ${cfg.gradientTo} 100%)`,
        border: `1px solid ${isClaimed ? "rgba(255,255,255,0.08)" : cfg.border}`,
        opacity: isClaimed ? 0.55 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.border}`,
              }}
            >
              {cfg.label}
            </span>
          </div>
          <h3
            className="text-sm font-semibold leading-tight"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {mission.title}
          </h3>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {mission.description}
          </p>
        </div>

        {/* Reward chips */}
        <div
          className="flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[72px]"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${cfg.border}`,
          }}
        >
          <span
            className="text-base font-bold"
            style={{ color: cfg.color }}
          >
            {formatChips(mission.rewardChips)}
          </span>
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            chips
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {t("missions.progress")}
          </span>
          <span
            className="text-xs font-medium"
            style={{
              color: isComplete ? cfg.color : "rgba(255,255,255,0.5)",
            }}
          >
            {mission.progress} / {mission.target}
          </span>
        </div>
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: isComplete
                ? `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`
                : `linear-gradient(90deg, ${cfg.color}66, ${cfg.color}99)`,
            }}
          />
        </div>
      </div>

      {/* Status / Claim */}
      <div className="pt-1">
        {isClaimed ? (
          <div
            className="w-full py-2 rounded-xl text-xs font-semibold text-center uppercase tracking-wider"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {t("missions.claimed")}
          </div>
        ) : isComplete ? (
          <button
            type="button"
            onClick={() => onClaim(mission.key)}
            disabled={isClaiming}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${cfg.color}ee, ${cfg.color}aa)`,
              color: "#000",
              boxShadow: `0 0 20px ${cfg.color}44`,
            }}
          >
            {isClaiming ? t("missions.claiming") : t("missions.claimReward")}
          </button>
        ) : (
          <div
            className="w-full py-2 rounded-xl text-xs font-medium text-center uppercase tracking-wider"
            style={{
              background: "rgba(0,0,0,0.2)",
              color: "rgba(255,255,255,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {isActive ? t("missions.inProgress") : t("missions.locked")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MissionsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
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
      void handleExpiredSession({ returnTo: "/missions" });
      return;
    }

    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? "");
    setUserId(payload?.sub ?? "");

    let cancelled = false;

    const loadMissions = async () => {
      try {
        const { data } = await api.get<Mission[]>("/missions");
        if (!cancelled) setMissions(data);
      } catch {
        if (!cancelled) setError(t("missions.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMissions();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const handleClaim = async (missionKey: string) => {
    setClaimingId(missionKey);
    setClaimMessage(null);

    // Backend auto-claims when mission completes (chips credited immediately).
    // We just refresh the mission list to show the updated CLAIMED status.
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data: updated } = await api.get<Mission[]>("/missions");
      setMissions(updated);
      const claimed = updated.find((m) => m.key === missionKey);
      if (claimed?.status === "CLAIMED") {
        setClaimMessage({
          type: "success",
          text: t("missions.claimSuccess", {
            amount: formatChips(claimed.rewardChips),
          }),
        });
      }
    } catch {
      setClaimMessage({
        type: "error",
        text: t("missions.claimError"),
      });
    } finally {
      setClaimingId(null);
    }
  };

  const oneTime = missions.filter((m) => m.type === "ONE_TIME");
  const daily = missions.filter((m) => m.type === "DAILY");
  const weekly = missions.filter((m) => m.type === "WEEKLY");

  const SectionHeader = ({
    label,
    color,
  }: {
    label: string;
    color: string;
  }) => (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: `${color}33` }}
      />
    </div>
  );

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
          {t("missions.title")}
        </h1>

        <div className="flex items-center gap-2">
          <UserAvatar userId={userId} size={28} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {nickname}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Feedback messages */}
        {claimMessage && (
          <div
            className="rounded-xl p-3 text-sm text-center animate-fade-in"
            style={{
              background:
                claimMessage.type === "success"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(248,113,113,0.12)",
              border: `1px solid ${
                claimMessage.type === "success"
                  ? "rgba(34,197,94,0.3)"
                  : "rgba(248,113,113,0.3)"
              }`,
              color:
                claimMessage.type === "success" ? "#4ade80" : "#f87171",
            }}
          >
            {claimMessage.text}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(245,158,11,0.3)", borderTopColor: "transparent" }}
            />
            <span
              className="text-sm"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
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

        {!loading && !error && (
          <div className="space-y-8">
            {/* ONE-TIME */}
            {oneTime.length > 0 && (
              <section>
                <SectionHeader
                  label={t("missions.oneTimeMissions")}
                  color="#eab308"
                />
                <div className="space-y-3">
                  {oneTime.map((mission) => (
                    <MissionCard
                      key={mission.key}
                      mission={mission}
                      onClaim={handleClaim}
                      claimingId={claimingId}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* DAILY */}
            {daily.length > 0 && (
              <section>
                <SectionHeader
                  label={t("missions.dailyMissions")}
                  color="#22c55e"
                />
                <div className="space-y-3">
                  {daily.map((mission) => (
                    <MissionCard
                      key={mission.key}
                      mission={mission}
                      onClaim={handleClaim}
                      claimingId={claimingId}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* WEEKLY */}
            {weekly.length > 0 && (
              <section>
                <SectionHeader
                  label={t("missions.weeklyMissions")}
                  color="#3b82f6"
                />
                <div className="space-y-3">
                  {weekly.map((mission) => (
                    <MissionCard
                      key={mission.key}
                      mission={mission}
                      onClaim={handleClaim}
                      claimingId={claimingId}
                    />
                  ))}
                </div>
              </section>
            )}

            {missions.length === 0 && (
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {t("missions.noMissions")}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
