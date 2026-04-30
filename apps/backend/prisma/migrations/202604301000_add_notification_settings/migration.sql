-- CreateNotificationSettings
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doNotDisturb" BOOLEAN NOT NULL DEFAULT false,
    "dndStart" INTEGER,
    "dndEnd" INTEGER,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" TO "notifications" ("userId");
CREATE INDEX "notifications_read_idx" TO "notifications" ("read");
CREATE INDEX "notifications_createdAt_idx" TO "notifications" ("createdAt");
CREATE INDEX "notifications_userId_createdAt_idx" TO "notifications" ("userId", "createdAt" DESC);
CREATE INDEX "notifications_userId_read_createdAt_idx" TO "notifications" ("userId", "read", "createdAt" DESC);
CREATE UNIQUE INDEX "user_notification_settings_userId_key" TO "user_notification_settings" ("userId");
CREATE INDEX "user_notification_settings_userId_idx" TO "user_notification_settings" ("userId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
