"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import type { UserNotificationSettings } from "@/lib/api/notifications";

interface NotificationSettingsPanelProps {
  settings: UserNotificationSettings;
  onUpdate: (data: Partial<UserNotificationSettings>) => Promise<void>;
  onClose: () => void;
}

function minutesToTime(minutes: number | null): string {
  if (minutes == null) return "22:00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function NotificationSettingsPanel({
  settings,
  onUpdate,
  onClose,
}: NotificationSettingsPanelProps) {
  const { t } = useTranslation("notification");
  const [doNotDisturb, setDoNotDisturb] = useState(settings.doNotDisturb);
  const [dndStart, setDndStart] = useState(
    minutesToTime(settings.dndStart),
  );
  const [dndEnd, setDndEnd] = useState(minutesToTime(settings.dndEnd));
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled);
  const [saving, setSaving] = useState(false);

  // Sync when settings change from outside (e.g., loaded from server)
  useEffect(() => {
    setDoNotDisturb(settings.doNotDisturb);
    setDndStart(minutesToTime(settings.dndStart));
    setDndEnd(minutesToTime(settings.dndEnd));
    setPushEnabled(settings.pushEnabled);
    setEmailEnabled(settings.emailEnabled);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        doNotDisturb,
        dndStart: timeToMinutes(dndStart),
        dndEnd: timeToMinutes(dndEnd),
        pushEnabled,
        emailEnabled,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">
          {t("settings.title", "Notification Settings")}
        </p>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Do Not Disturb */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {t("settings.doNotDisturb", "Do Not Disturb")}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t(
              "settings.quietHoursDesc",
              "Mute notifications during set hours",
            )}
          </p>
        </div>
        <button
          onClick={() => setDoNotDisturb((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            doNotDisturb ? "bg-amber-500" : "bg-gray-600"
          }`}
          aria-pressed={doNotDisturb}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              doNotDisturb ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Quiet Hours */}
      {doNotDisturb && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">
              {t("settings.startTime", "Start Time")}
            </label>
            <input
              type="time"
              value={dndStart}
              onChange={(e) => setDndStart(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">
              {t("settings.endTime", "End Time")}
            </label>
            <input
              type="time"
              value={dndEnd}
              onChange={(e) => setDndEnd(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      )}

      {/* Push Notifications */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">
          {t("settings.pushEnabled", "Push Notifications")}
        </p>
        <button
          onClick={() => setPushEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            pushEnabled ? "bg-amber-500" : "bg-gray-600"
          }`}
          aria-pressed={pushEnabled}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              pushEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Email Notifications */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">
          {t("settings.emailEnabled", "Email Notifications")}
        </p>
        <button
          onClick={() => setEmailEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            emailEnabled ? "bg-amber-500" : "bg-gray-600"
          }`}
          aria-pressed={emailEnabled}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              emailEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 transition-colors disabled:opacity-50"
      >
        {saving
          ? "..."
          : t("settings.save", "Save Settings")}
      </button>
    </div>
  );
}
