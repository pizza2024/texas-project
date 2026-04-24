"use client";

import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useEffect, useState } from 'react';

interface SearchingOverlayProps {
  onCancel: () => void;
}

export function SearchingOverlay({ onCancel }: SearchingOverlayProps) {
  const { t } = useTranslation();
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

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
        {/* Radar / pulse animation */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Outer ring */}
          <span
            className="absolute inset-0 rounded-full border border-yellow-400/20 animate-ping"
            style={{ animationDuration: '2s' }}
          />
          {/* Middle ring */}
          <span
            className="absolute inset-2 rounded-full border border-yellow-400/30 animate-ping"
            style={{ animationDuration: '1.5s', animationDelay: '0.3s' }}
          />
          {/* Inner ring */}
          <span
            className="absolute inset-4 rounded-full border border-yellow-400/40 animate-ping"
            style={{ animationDuration: '1s', animationDelay: '0.6s' }}
          />
          {/* Center icon */}
          <div
            className="relative w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, rgba(245,158,11,0.05) 100%)',
              border: '1px solid rgba(245,158,11,0.4)',
            }}
          >
            <span className="text-lg">⚡</span>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <p
            className="text-xl font-black tracking-widest uppercase"
            style={{ color: "#fcd34d" }}
          >
            {t("lobby.searching")}{dots}
          </p>
          <p
            className="text-xs tracking-wide"
            style={{ color: "rgba(245,158,11,0.45)" }}
          >
            {t("lobby.searchingHint") ?? "Finding the best table for you"}
          </p>
        </div>

        {/* Cancel button */}
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
