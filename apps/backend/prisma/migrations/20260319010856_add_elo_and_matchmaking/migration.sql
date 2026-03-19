-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "blindSmall" REAL NOT NULL,
    "blindBig" REAL NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "minBuyIn" REAL NOT NULL DEFAULT 0,
    "password" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isMatchmaking" BOOLEAN NOT NULL DEFAULT false,
    "tier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_rooms" ("blindBig", "blindSmall", "createdAt", "id", "maxPlayers", "minBuyIn", "name", "password", "status") SELECT "blindBig", "blindSmall", "createdAt", "id", "maxPlayers", "minBuyIn", "name", "password", "status" FROM "rooms";
DROP TABLE "rooms";
ALTER TABLE "new_rooms" RENAME TO "rooms";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "coinBalance" REAL NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);
INSERT INTO "new_users" ("avatar", "coinBalance", "createdAt", "id", "lastLoginAt", "nickname", "password", "role", "status", "username") SELECT "avatar", "coinBalance", "createdAt", "id", "lastLoginAt", "nickname", "password", "role", "status", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
