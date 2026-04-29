"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface MatchingOverlayProps {
  isVisible: boolean;
  players?: string[]; // usernames or placeholders
  countdownSeconds?: number; // 0 means no countdown
  onTimeout?: () => void;
}

export function MatchingOverlay({
  isVisible,
  players = [],
  countdownSeconds = 0,
  onTimeout,
}: MatchingOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    setSecondsLeft(countdownSeconds);
  }, [countdownSeconds]);

  useEffect(() => {
    if (!isVisible || countdownSeconds <= 0) return;

    if (secondsLeft <= 0) {
      onTimeout?.();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, countdownSeconds, secondsLeft, onTimeout]);

  const isUrgent = secondsLeft <= 10 && secondsLeft > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8"
          style={{ background: "rgba(5,2,1,0.95)" }}
        >
          {/* Animated title */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-center"
          >
            <p
              className="text-sm uppercase tracking-[0.4em] mb-2"
              style={{ color: "rgba(249,115,22,0.6)" }}
            >
              Matching Players
            </p>
            <h2 className="text-4xl font-black" style={{ color: "#f97316" }}>
              💥 BLAST 💥
            </h2>
          </motion.div>

          {/* Pulsing dots */}
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-full"
                style={{ background: "#f97316" }}
                animate={{ scale: [0.5, 1.5, 0.5], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>

          {/* Player slots */}
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black"
                style={{
                  background: players[i]
                    ? "rgba(249,115,22,0.15)"
                    : "rgba(255,255,255,0.05)",
                  border: players[i]
                    ? "2px solid rgba(249,115,22,0.3)"
                    : "2px dashed rgba(255,255,255,0.1)",
                  color: players[i] ? "#fff" : "rgba(255,255,255,0.2)",
                }}
                animate={players[i] ? {} : { opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {players[i] ? "👤" : "?"}
              </motion.div>
            ))}
          </div>

          {/* Countdown display */}
          {countdownSeconds > 0 && secondsLeft > 0 && (
            <motion.div
              className={`countdown-badge ${isUrgent ? "countdown-badge-urgent" : ""}`}
              style={{
                background: isUrgent
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(249, 115, 22, 0.15)",
                borderColor: isUrgent
                  ? "rgba(239, 68, 68, 0.5)"
                  : "rgba(249, 115, 22, 0.3)",
                color: isUrgent ? "#ef4444" : "#f97316",
              }}
              animate={isUrgent ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {secondsLeft}s
            </motion.div>
          )}

          <p className="text-sm" style={{ color: "rgba(156,163,175,0.5)" }}>
            Waiting for players to join...
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
