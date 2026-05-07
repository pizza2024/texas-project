"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confettiLib from "canvas-confetti";
import { useTranslation } from "react-i18next";

const hasConfetti =
  typeof window !== "undefined" &&
  typeof (window as unknown as Record<string, unknown>)["confetti"] ===
    "function";
const confetti = hasConfetti ? confettiLib : null;

export interface BadBeatJackpotData {
  handId: string;
  jackpotAmount: number;
  pot: number;
  loser: {
    userId: string;
    nickname: string;
    hand: string;
    netLoss: number;
    payout: number;
  };
  winner: {
    userId: string;
    nickname: string;
    hand: string;
    payout: number;
  };
  tablePlayers: Array<{
    userId: string;
    nickname: string;
    payout: number;
  }>;
  animationDurationMs: number;
}

interface BadBeatJackpotModalProps {
  data: BadBeatJackpotData | null;
  currentUserId?: string;
  onClose: () => void;
}

export function BadBeatJackpotModal({
  data,
  currentUserId,
  onClose,
}: BadBeatJackpotModalProps) {
  const { t } = useTranslation();
  const confettiFired = useRef(false);
  const isLoser = data?.loser.userId === currentUserId;
  const isWinner = data?.winner.userId === currentUserId;
  const isTablePlayer = data?.tablePlayers.some(
    (p) => p.userId === currentUserId,
  );

  const fireConfetti = useCallback(() => {
    if (!confetti || confettiFired.current) return;
    confettiFired.current = true;

    const duration = 4000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#FFD700", "#FFA500", "#FF8C00", "#FFD700"],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#FFD700", "#FFA500", "#FF8C00", "#FFD700"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Golden sparkle burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ["#FFD700", "#FFEC8B", "#FFFACD"],
      startVelocity: 45,
    });
  }, []);

  useEffect(() => {
    if (data) {
      confettiFired.current = false;
      // Small delay so animation is visible
      const timer = setTimeout(fireConfetti, 300);
      return () => clearTimeout(timer);
    }
  }, [data, fireConfetti]);

  const duration = data?.animationDurationMs ?? 5000;

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(5,2,1,0.92)" }}
          onClick={onClose}
        >
          {/* Golden particle ambient animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-yellow-400 opacity-60"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-10%",
                }}
                animate={{
                  y: ["0vh", "110vh"],
                  opacity: [0, 0.8, 0],
                  scale: [0.5, 1.5, 0.5],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* Central card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative z-10 mx-4 w-full max-w-lg rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-yellow-900/30 via-yellow-950/50 to-black/80 p-8 shadow-[0_0_60px_rgba(255,215,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-center mb-6"
            >
              <p
                className="text-xs uppercase tracking-[0.5em] mb-2"
                style={{ color: "rgba(255,215,0,0.6)" }}
              >
                {t("badbeat.badge", "Bad Beat Jackpot")}
              </p>
              <h2
                className="text-4xl font-black tracking-wider"
                style={{
                  color: "#FFD700",
                  textShadow: "0 0 30px rgba(255,215,0,0.6)",
                }}
              >
                BAD BEAT JACKPOT
              </h2>
            </motion.div>

            {/* Hand comparison */}
            <div className="mb-6 rounded-xl bg-black/40 p-4 border border-yellow-500/20">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {/* Loser hand */}
                <div className="text-center">
                  <p
                    className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "rgba(255,100,100,0.7)" }}
                  >
                    {t("badbeat.loser", "Loser")}
                    {isLoser && (
                      <span className="ml-1 text-yellow-400">(YOU)</span>
                    )}
                  </p>
                  <p className="text-xl font-mono font-bold text-red-400">
                    {data.loser.hand}
                  </p>
                  <p className="text-xs text-red-400/60 mt-1">
                    {t("badbeat.netLoss", "Net Loss")}:{" "}
                    {data.loser.netLoss.toFixed(2)}
                  </p>
                </div>

                {/* VS indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-black"
                    style={{
                      background: "rgba(255,215,0,0.15)",
                      border: "2px solid rgba(255,215,0,0.4)",
                    }}
                  >
                    ⚡
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "rgba(255,215,0,0.5)" }}>
                    BEAT
                  </div>
                </div>

                {/* Winner hand */}
                <div className="text-center">
                  <p
                    className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "rgba(100,255,100,0.7)" }}
                  >
                    {t("badbeat.winner", "Winner")}
                    {isWinner && (
                      <span className="ml-1 text-yellow-400">(YOU)</span>
                    )}
                  </p>
                  <p className="text-xl font-mono font-bold text-emerald-400">
                    {data.winner.hand}
                  </p>
                </div>
              </div>
            </div>

            {/* Jackpot amount */}
            <div className="text-center mb-5">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,215,0,0.5)" }}>
                {t("badbeat.jackpotPool", "Jackpot Pool")}
              </p>
              <p
                className="text-5xl font-black"
                style={{
                  color: "#FFD700",
                  textShadow: "0 0 20px rgba(255,215,0,0.5)",
                }}
              >
                ${(data.jackpotAmount / 100).toFixed(2)}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,215,0,0.4)" }}>
                {t("badbeat.pot", "Pot")}: ${(data.pot / 100).toFixed(2)}
              </p>
            </div>

            {/* Payout breakdown */}
            <div className="space-y-2 mb-6">
              {/* Loser payout */}
              <div
                className="flex items-center justify-between rounded-lg px-4 py-2"
                style={{
                  background:
                    isLoser
                      ? "rgba(255,215,0,0.15)"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isLoser ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span>💔</span>
                  <span className="text-sm text-white/80">
                    {t("badbeat.badBeatLoser", "Bad Beat Loser")}
                  </span>
                  {isLoser && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: "rgba(255,215,0,0.2)",
                        color: "#FFD700",
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <span className="font-bold text-yellow-400">
                  +${(data.loser.payout / 100).toFixed(2)}
                </span>
              </div>

              {/* Winner payout */}
              <div
                className="flex items-center justify-between rounded-lg px-4 py-2"
                style={{
                  background:
                    isWinner
                      ? "rgba(255,215,0,0.15)"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isWinner ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span>🏆</span>
                  <span className="text-sm text-white/80">
                    {t("badbeat.hotHandWinner", "Hot Hand Winner")}
                  </span>
                  {isWinner && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: "rgba(255,215,0,0.2)",
                        color: "#FFD700",
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <span className="font-bold text-yellow-400">
                  +${(data.winner.payout / 100).toFixed(2)}
                </span>
              </div>

              {/* Table players payout */}
              {data.tablePlayers.length > 0 && (
                <div
                  className="rounded-lg px-4 py-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>👥</span>
                    <span className="text-sm text-white/60 uppercase tracking-wider text-xs">
                      {t("badbeat.tablePlayers", "Table Players")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {data.tablePlayers.map((player) => (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-white/60 flex items-center gap-1">
                          {player.nickname}
                          {player.userId === currentUserId && (
                            <span
                              className="text-[10px] px-1 py-0.5 rounded font-bold"
                              style={{
                                background: "rgba(255,215,0,0.2)",
                                color: "#FFD700",
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </span>
                        <span className="text-yellow-400/80">
                          +${(player.payout / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dismiss hint */}
            <p
              className="text-center text-xs"
              style={{ color: "rgba(255,215,0,0.3)" }}
            >
              {t("badbeat.tapToDismiss", "Tap anywhere to dismiss")}
            </p>

            {/* Auto-dismiss progress bar */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl"
              style={{ background: "rgba(255,215,0,0.3)" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: duration / 1000, ease: "linear" }}
              onAnimationComplete={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
