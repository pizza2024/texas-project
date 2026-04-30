import api from "@/lib/api";

export interface UserNotificationSettings {
  id: string;
  userId: string;
  doNotDisturb: boolean;
  dndStart: number | null;
  dndEnd: number | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getNotificationSettings = () =>
  api.get<UserNotificationSettings>("/notifications/settings");

export const updateNotificationSettings = (data: Partial<UserNotificationSettings>) =>
  api.patch("/notifications/settings", data);
