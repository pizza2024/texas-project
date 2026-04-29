"use client";

import { useEffect, useState } from "react";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-2xl border"
        style={{
          backgroundColor: "#0d1f22",
          borderColor: "#1a3a3f",
        }}
      >
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "#e8f4f0" }}>
            Install CHIPS for a better experience
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#7a9e9a" }}>
            Add to home screen to play offline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ color: "#7a9e9a" }}
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95"
            style={{
              backgroundColor: "#22c55e",
              color: "#060e10",
            }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
