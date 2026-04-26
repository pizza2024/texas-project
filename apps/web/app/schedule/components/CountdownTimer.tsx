"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetTime: string | Date | null;
  onComplete?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(targetMs: number): TimeLeft {
  const diff = targetMs - Date.now();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total: diff };
}

function padZero(n: number): string {
  return n.toString().padStart(2, "0");
}

export function CountdownTimer({
  targetTime,
  onComplete,
  className = "",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  // Sync state whenever targetTime changes
  useEffect(() => {
    if (!targetTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown timer must sync state
      setTimeLeft(null);
      return;
    }
    const targetMs = new Date(targetTime).getTime();
    setTimeLeft(calculateTimeLeft(targetMs));

    const interval = setInterval(() => {
      const next = calculateTimeLeft(targetMs);
      setTimeLeft(next);
      if (next.total <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  if (!targetTime) {
    return (
      <span className={`text-gray-500 text-sm ${className}`}>--:--:--</span>
    );
  }

  if (!timeLeft) {
    return (
      <span className={`text-gray-400 text-sm ${className}`}>Loading...</span>
    );
  }

  if (timeLeft.total <= 0) {
    return (
      <span className={`text-green-400 font-semibold text-sm ${className}`}>
        Starting Now!
      </span>
    );
  }

  const isUrgent = timeLeft.total < 5 * 60 * 1000;

  return (
    <span
      className={`font-mono text-sm tabular-nums ${isUrgent ? "text-red-400" : "text-yellow-400"} ${className}`}
    >
      {padZero(timeLeft.days)}:{padZero(timeLeft.hours)}:
      {padZero(timeLeft.minutes)}:{padZero(timeLeft.seconds)}
    </span>
  );
}
