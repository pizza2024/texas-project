"use client";

import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

interface SearchingOverlayProps {
  onCancel: () => void;
}

export function SearchingOverlay({ onCancel }: SearchingOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative flex flex-col items-center gap-6 px-10 py-9 rounded-3xl"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.99) 0%, rgba(6,12,9,1) 100%)",
          border: "1px solid rgba(234,179,8,0.3)",
          boxShadow:
            "0 0 60px rgba(234,179,8,0.08), 0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          className="text-5xl animate-spin"
          style={{ animationDuration: "1.5s" }}
        >
          ⚡
        </div>
        <div className="text-center space-y-1.5">
          <p
            className="text-xl font-black tracking-widest uppercase"
            style={{ color: "#fcd34d" }}
          >
            {t("lobby.searching")}
          </p>
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
        <button
          className="text-xs font-bold tracking-[0.2em] uppercase px-6 py-2.5 rounded-lg transition-colors hover:bg-white/10"
          style={{
            color: "rgba(245,158,11,0.6)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
          onClick={onCancel}
        >
          {t("lobby.searchingCancel")}
        </button>
      </div>
    </div>
  );
}
