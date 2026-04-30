import { useState, useEffect, useCallback, useRef } from "react";
import { setNotificationHandler } from "@/lib/socket";
import api from "@/lib/api";
import type { NotificationPayload } from "@texas/shared";
import type { UserNotificationSettings } from "@/lib/api/notifications";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/api/notifications";

export type NotificationItem = NotificationPayload;

export interface UseNotificationsOptions {
  userId?: string;
}

export interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  settings: UserNotificationSettings | null;
  updateSettings: (data: Partial<UserNotificationSettings>) => Promise<void>;
}

const PAGE_SIZE = 20;

export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const { userId } = options;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const userIdRef = useRef(userId);

  // Keep userIdRef in sync so the socket handler always uses the latest
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ── Fetch initial data ───────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!userIdRef.current) return;
    setIsLoading(true);
    try {
      const res = await api.get<{
        data: NotificationItem[];
        total: number;
        unreadCount: number;
      }>("/notifications", { params: { page: 1, limit: PAGE_SIZE } });
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // Non-blocking — keep existing state on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Real-time socket handler ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (data: NotificationPayload) => {
      // Only apply to the current user
      if (data.userId !== userIdRef.current) return;

      setNotifications((prev) => [data, ...prev]);
      if (!data.read) {
        setUnreadCount((c) => c + 1);
      }
    };

    setNotificationHandler(handler);

    return () => {
      setNotificationHandler(() => null);
    };
  }, []);

  // ── Mark read ───────────────────────────────────────────────────────────

  const markRead = useCallback(async (ids: string[]) => {
    try {
      await api.patch("/notifications/read", { ids });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    } catch {
      // Non-blocking
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const res = await getNotificationSettings();
      setSettings(res.data);
    } catch {
      // Non-blocking
    }
  }, []);

  const updateSettings = useCallback(
    async (data: Partial<UserNotificationSettings>) => {
      try {
        const res = await updateNotificationSettings(data);
        setSettings(res.data);
      } catch {
        // Non-blocking
      }
    },
    [],
  );

  // Load settings
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
    settings,
    updateSettings,
  };
}
