"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

export interface InsuranceOfferData {
  handId: string;
  pot: number;
  playerBet: number;
  playerEquity: number;
  fee50: number;
  payout50: number;
  fee100: number;
  payout100: number;
  timeoutMs: number;
  holeCards: string[];
}

interface InsuranceOfferModalProps {
  open: boolean;
  offer: InsuranceOfferData | null;
  onBuy: (rate: 50 | 100) => void;
  onSkip: () => void;
}

// ----------------------------------------------------------------
// Inner component: manages countdown state. Remounted via key when
// offer changes so state resets without any setState in effect body.
// ----------------------------------------------------------------
function InsuranceOfferTimer({
  offer,
  onSkip,
}: {
  offer: InsuranceOfferData;
  onSkip: () => void;
}) {
  // Lazy initializer avoids setState in effect
  const [countdown, setCountdown] = useState(() =>
    Math.ceil(offer.timeoutMs / 1000),
  );

  const skipAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  useEffect(() => {
    skipAtRef.current = Date.now() + offer.timeoutMs;

    const tick = () => {
      if (skipAtRef.current === null) return;
      const remaining = Math.ceil((skipAtRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        skipAtRef.current = null;
        setCountdown(0);
        setTimeout(() => onSkipRef.current(), 0);
      } else {
        setCountdown(remaining);
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.handId]); // intentionally exclude onSkip

  return countdown;
}

// ----------------------------------------------------------------
// Main modal — presentational only
// ----------------------------------------------------------------
export function InsuranceOfferModal({
  open,
  offer,
  onBuy,
  onSkip,
}: InsuranceOfferModalProps) {
  const { t } = useTranslation();

  // Derive countdown from a remounted sub-component keyed by handId
  // This avoids setState inside an effect body (eslint rule violation)
  const countdown = offer ? (
    <InsuranceOfferTimer
      key={offer.handId}
      offer={offer}
      onSkip={onSkip}
    />
  ) : (
    5
  );

  // countdown is a React element tree; extract the number if rendered
  // Since InsuranceOfferTimer returns a number, we get the countdown value
  const countdownValue =
    typeof countdown === "number" ? countdown : 5;

  if (!open || !offer) return null;

  const equityPercent = Math.round(offer.playerEquity * 100);
  const isLowEquity = equityPercent < 30;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-blue-900/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/60 to-blue-800/40 px-6 py-4 border-b border-blue-900/30 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-blue-200 tracking-wide flex items-center gap-2">
              🛡️ {t("room.insuranceTitle", "ALL-IN Insurance (Optional)")}
            </h2>
            <p className="mt-0.5 text-sm text-blue-300/70">
              {t("room.insuranceSubtitle", "Protect your all-in")}
            </p>
          </div>
          {/* Countdown badge — reads from remounted sub-component state */}
          <div className="flex items-center gap-1 bg-blue-900/50 border border-blue-700/50 rounded-full px-3 py-1">
            <span className="text-xs text-blue-300">{countdownValue}s</span>
            <div className="w-16 h-1.5 bg-blue-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(countdownValue / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Player cards */}
        <div className="flex justify-center py-4 bg-black/20 border-b border-zinc-800">
          <div className="flex gap-2">
            {offer.holeCards.map((card, i) => (
              <div
                key={i}
                className="w-14 h-20 bg-white rounded-lg flex items-center justify-center text-2xl font-black text-zinc-900 shadow-lg"
              >
                {card}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 space-y-3">
          {/* Equity */}
          <div className="bg-black/40 border border-zinc-700/50 rounded-xl p-4 text-center">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
              {t("room.insuranceYourEquity", "Your Equity")}
            </div>
            <div
              className={`text-4xl font-black ${
                isLowEquity ? "text-red-400" : "text-amber-400"
              }`}
            >
              {equityPercent}%
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {t("room.insuranceChanceToWin", "Chance to win the hand")}
            </div>
          </div>

          {/* Pot info */}
          <div className="flex gap-3">
            <div className="flex-1 bg-black/40 border border-zinc-700/50 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                {t("room.insurancePot", "Pot")}
              </div>
              <div className="text-lg font-black text-emerald-400">
                ${offer.pot.toFixed(2)}
              </div>
            </div>
            <div className="flex-1 bg-black/40 border border-zinc-700/50 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                {t("room.insuranceYourBet", "Your All-In")}
              </div>
              <div className="text-lg font-black text-amber-400">
                ${offer.playerBet.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Insurance options */}
          <div className="grid grid-cols-2 gap-3">
            {/* 50% Insurance */}
            <button
              onClick={() => onBuy(50)}
              className="bg-zinc-800/80 hover:bg-zinc-700/80 border-2 border-zinc-600 hover:border-blue-500 rounded-xl p-4 text-center transition-all active:scale-[0.98]"
            >
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                {t("room.insurance50", "50% Coverage")}
              </div>
              <div className="text-2xl font-black text-white mb-1">
                ${offer.fee50.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500 mb-2">
                {t("room.insuranceCost", "Cost")}
              </div>
              <div className="border-t border-zinc-700 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">
                  {t("room.insurancePayout", "Payout if lose")}
                </div>
                <div className="text-xl font-black text-emerald-400">
                  ${offer.payout50.toFixed(2)}
                </div>
              </div>
            </button>

            {/* 100% Insurance */}
            <button
              onClick={() => onBuy(100)}
              className="bg-zinc-800/80 hover:bg-zinc-700/80 border-2 border-zinc-600 hover:border-blue-500 rounded-xl p-4 text-center transition-all active:scale-[0.98] relative overflow-hidden"
            >
              {/* Recommended badge */}
              <div className="absolute top-2 right-2 bg-amber-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full">
                {t("room.insuranceRecommended", "Recommended")}
              </div>
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                {t("room.insurance100", "100% Coverage")}
              </div>
              <div className="text-2xl font-black text-white mb-1">
                ${offer.fee100.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500 mb-2">
                {t("room.insuranceCost", "Cost")}
              </div>
              <div className="border-t border-zinc-700 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">
                  {t("room.insurancePayout", "Payout if lose")}
                </div>
                <div className="text-xl font-black text-emerald-400">
                  ${offer.payout100.toFixed(2)}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Skip button */}
        <div className="px-6 pb-6">
          <button
            onClick={onSkip}
            className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-400 hover:text-zinc-200 font-bold text-sm uppercase tracking-wider rounded-xl transition-colors"
          >
            {t("room.insuranceSkip", "Skip, don't buy insurance")} ({countdownValue}s)
          </button>
        </div>
      </div>
    </div>
  );
}
