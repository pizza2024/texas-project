"use client";

import { BLAST_BUYINS } from "@texas/shared/types/tournament";

interface BlastBuyinSelectorProps {
  value: number;
  onChange: (buyin: number) => void;
}

export function BlastBuyinSelector({
  value,
  onChange,
}: BlastBuyinSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {BLAST_BUYINS.map((buyin) => {
        const isSelected = value === buyin;
        return (
          <button
            key={buyin}
            type="button"
            onClick={() => onChange(buyin)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              background: isSelected
                ? "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)"
                : "rgba(255,255,255,0.05)",
              color: isSelected ? "#000" : "rgba(255,255,255,0.7)",
              border: isSelected ? "none" : "1px solid rgba(249,115,22,0.25)",
              boxShadow: isSelected ? "0 0 20px rgba(249,115,22,0.3)" : "none",
            }}
          >
            💰 {buyin.toLocaleString()}
          </button>
        );
      })}
    </div>
  );
}
