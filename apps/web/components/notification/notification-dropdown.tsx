"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import type { NotificationItem } from "@/hooks/use-notifications";
import type { UserNotificationSettings } from "@/lib/api/notifications";
import { NotificationSettingsPanel } from "./notification-settings-panel";

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkRead: (ids: string[]) => void;
  onMarkAllRead: () => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  settings: UserNotificationSettings | null | undefined;
  onUpdateSettings: (data: Partial<UserNotificationSettings>) => Promise<void>;
}

const TYPE_ICONS: Record<string, string> = {
  friend_online: "🟢",
  friend_offline: "⚫",
  friend_request: "👥",
  deposit: "💰",
  withdraw: "💸",
  tournament: "🏆",
  system: "⚙️",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export function NotificationDropdown({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  settingsOpen,
  onSettingsToggle,
  settings,
  onUpdateSettings,
}: NotificationDropdownProps) {
  const { t } = useTranslation("notification");
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

  // Show settings panel if toggled
  if (settingsOpen) {
    return (
      <div
        className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
        style={{
          background: "rgba(6,12,9,0.98)",
          border: "1px solid rgba(234,179,8,0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        {settings ? (
          <NotificationSettingsPanel
            settings={settings}
            onUpdate={onUpdateSettings}
            onClose={onSettingsToggle}
          />
        ) : (
          <div className="flex items-center justify-center py-8">
            <span className="text-gray-500 text-sm">...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
      style={{
        background: "rgba(6,12,9,0.98)",
        border: "1px solid rgba(234,179,8,0.2)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(234,179,8,0.1)" }}
      >
        <p className="text-sm font-bold text-white">
          {t("dropdown.title", "Notifications")}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onSettingsToggle}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            title={t("settings.title", "Settings")}
          >
            ⚙️
          </button>
          {unreadIds.length > 0 && (
            <button
              onClick={() => {
                onMarkAllRead();
              }}
              className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
            >
              {t("dropdown.markAllRead", "Mark all read")}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto py-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <span className="text-3xl mb-3">🔔</span>
            <p className="text-sm text-gray-400 text-center">
              {t("dropdown.empty", "No notifications yet")}
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const icon = TYPE_ICONS[notif.type] ?? "📌";
            return (
              <button
                key={notif.id}
                onClick={() => {
                  if (!notif.read) {
                    onMarkRead([notif.id]);
                  }
                }}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/5 ${
                  !notif.read ? "bg-white/[0.03]" : ""
                }`}
                style={{
                  borderLeft: !notif.read
                    ? "3px solid rgba(234,179,8,0.6)"
                    : "3px solid transparent",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white truncate">
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                          }}
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className="px-4 py-2.5 text-center"
          style={{ borderTop: "1px solid rgba(234,179,8,0.1)" }}
        >
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t("dropdown.close", "Close")}
          </button>
        </div>
      )}
    </div>
  );
}
