-- AlterTable
ALTER TABLE "tables" ADD COLUMN "snapshotUpdatedAt" DATETIME;
ALTER TABLE "tables" ADD COLUMN "stateSnapshot" TEXT;

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
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_rooms" ("blindBig", "blindSmall", "createdAt", "id", "maxPlayers", "name", "status") SELECT "blindBig", "blindSmall", "createdAt", "id", "maxPlayers", "name", "status" FROM "rooms";
DROP TABLE "rooms";
ALTER TABLE "new_rooms" RENAME TO "rooms";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
