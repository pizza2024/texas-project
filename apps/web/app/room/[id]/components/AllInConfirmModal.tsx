"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";

interface AllInConfirmModalProps {
  open: boolean;
  amount: number;
  potOdds: number;
  equity: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AllInConfirmModal({
  open,
  amount,
  potOdds,
  equity,
  onConfirm,
  onCancel,
}: AllInConfirmModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const potOddsPercent = Math.round(potOdds * 100);
  const equityPercent = Math.round(equity);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-red-900/50 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/60 to-red-800/40 px-6 py-4 border-b border-red-900/30">
          <h2 className="text-xl font-black text-red-200 tracking-wide">
            {t("room.allInConfirmTitle")}
          </h2>
          <p className="mt-1 text-sm text-red-300/70">
            {t("room.allInConfirmDescription", { amount })}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-6 py-5">
          {/* Pot Odds */}
          <div className="flex-1 bg-black/40 border border-zinc-700/50 rounded-xl p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              {t("room.allInPotOdds")}
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {potOddsPercent}%
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              {potOdds >= 1 ? "1:1" : `1:${Math.round(1 / potOdds)}`}
            </div>
          </div>

          {/* Your Equity */}
          <div className="flex-1 bg-black/40 border border-zinc-700/50 rounded-xl p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              {t("room.allInEquity")}
            </div>
            <div className="text-2xl font-black text-amber-400">
              {equityPercent}%
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              {equityPercent > potOddsPercent ? "Good value" : "Bluff spot"}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 font-bold text-sm uppercase tracking-wider rounded-xl transition-colors"
          >
            {t("room.allInCancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-12 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-[0.98]"
          >
            {t("room.allInConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
