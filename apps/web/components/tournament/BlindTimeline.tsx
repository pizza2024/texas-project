"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import "@/lib/i18n";
import type { BlindLevel } from "@texas/shared/types/tournament";

interface BlindTimelineProps {
  /** Array of blind levels for the tournament */
  blinds: BlindLevel[];
  /** 0-indexed current blind level */
  currentLevel: number;
  /** Unix timestamp (ms) when the current blind level started */
  levelStartedAt: number;
  /** Callback when user clicks a level tab */
  onLevelChange?: (levelIndex: number) => void;
}

/**
 * Returns a progress color based on tournament stage.
 * Green (early) → Yellow (mid) → Red (late)
 */
function getStageColor(currentIndex: number, totalLevels: number): string {
  const progress = totalLevels <= 1 ? 0 : currentIndex / (totalLevels - 1);
  if (progress < 0.33) return "#22c55e"; // green-500
  if (progress < 0.66) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

/**
 * Formats seconds into MM:SS display.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BlindTimeline({
  blinds,
  currentLevel,
  levelStartedAt,
  onLevelChange,
}: BlindTimelineProps) {
  const { t } = useTranslation();

  const totalLevels = blinds.length;
  const level = blinds[currentLevel];

  // Track whether this is the first render (mount) to sync from props.
  // Using a ref so this check doesn't cause extra renders.
  const isFirstRender = useRef(true);
  const prevLevelStartedAt = useRef(levelStartedAt);
  const prevCurrentLevel = useRef(currentLevel);

  // secondsLeft is initialised to 0; correct value is set in the effect below.
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Stable ref for duration so the interval callback always reads the latest.
  const durationRef = useRef(level?.durationSeconds ?? 0);
  useEffect(() => {
    durationRef.current = level?.durationSeconds ?? 0;
  }, [level?.durationSeconds]);

  useEffect(() => {
    if (level == null) return;

    // Compute the correct initial value on mount.
    // After mount we rely solely on the interval to decrement.
    const elapsed = Math.floor((Date.now() - levelStartedAt) / 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must sync initial state from prop
    setSecondsLeft(Math.max(0, level.durationSeconds - elapsed));

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [levelStartedAt, level]);

  // Sync when the active level changes from outside (e.g. socket update).
  useEffect(() => {
    if (
      isFirstRender.current ||
      levelStartedAt !== prevLevelStartedAt.current ||
      currentLevel !== prevCurrentLevel.current
    ) {
      isFirstRender.current = false;
      prevLevelStartedAt.current = levelStartedAt;
      prevCurrentLevel.current = currentLevel;
      if (level != null) {
        const elapsed = Math.floor((Date.now() - levelStartedAt) / 1000);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- must sync state when level changes from socket
        setSecondsLeft(Math.max(0, level.durationSeconds - elapsed));
      }
    }
  }, [levelStartedAt, currentLevel, level]);

  if (!level) return null;

  const levelProgress = 1 - secondsLeft / (level.durationSeconds || 1);
  const stageColor = getStageColor(currentLevel, totalLevels);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{
        background:
          "linear-gradient(160deg, rgba(20,10,5,0.95) 0%, rgba(10,5,2,0.98) 100%)",
        border: "1px solid rgba(249,115,22,0.2)",
        boxShadow: "0 0 20px rgba(249,115,22,0.05)",
      }}
    >
      {/* Header row: level number + blinds + countdown */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Level badge */}
        <div className="flex items-center gap-2">
          <motion.span
            className="text-xs font-bold tracking-widest uppercase px-2 py-1 rounded-lg"
            style={{
              background: `${stageColor}20`,
              color: stageColor,
              border: `1px solid ${stageColor}40`,
            }}
            key={currentLevel}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {t("tournament.level", { level: currentLevel + 1 })}
          </motion.span>
          <span
            className="text-xs tracking-wide"
            style={{ color: "rgba(156,163,175,0.5)" }}
          >
            {t("tournament.ofLevels", {
              current: currentLevel + 1,
              total: totalLevels,
            })}
          </span>
        </div>

        {/* Current blinds */}
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            💰{" "}
            {t("tournament.sbBb", {
              sb: level.smallBlind,
              bb: level.bigBlind,
            })}
          </span>
        </div>

        {/* Countdown to next level */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "rgba(156,163,175,0.5)" }}
          >
            {t("tournament.nextLevel")}
          </span>
          <motion.span
            className="text-lg font-black tabular-nums"
            style={{ color: stageColor }}
            animate={secondsLeft <= 10 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {formatTime(secondsLeft)}
          </motion.span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: stageColor }}
          initial={{ width: 0 }}
          animate={{ width: `${levelProgress * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Level tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {blinds.map((blind, index) => {
          const color = getStageColor(index, totalLevels);
          const isActive = index === currentLevel;
          const isPast = index < currentLevel;

          return (
            <button
              key={index}
              onClick={() => onLevelChange?.(index)}
              className="relative shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all hover:opacity-100"
              style={{
                opacity: isActive ? 1 : isPast ? 0.5 : 0.7,
                background: isActive ? `${color}15` : "transparent",
                border: isActive
                  ? `1px solid ${color}40`
                  : "1px solid transparent",
              }}
            >
              <span
                className="text-[10px] font-bold tracking-wide"
                style={{
                  color: isActive ? color : "rgba(156,163,175,0.6)",
                }}
              >
                {index + 1}
              </span>
              <span
                className="text-[9px] tracking-wider"
                style={{ color: "rgba(156,163,175,0.4)" }}
              >
                {blind.smallBlind}/{blind.bigBlind}
              </span>
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full"
                  style={{ background: color }}
                  layoutId="blind-indicator"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
