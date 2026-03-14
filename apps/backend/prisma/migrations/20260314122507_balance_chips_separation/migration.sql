/*
  Warnings:

  - You are about to drop the column `frozenBalance` on the `wallets` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "chips" REAL NOT NULL DEFAULT 0,
    "frozenChips" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_wallets" ("balance", "id", "userId") SELECT "balance", "id", "userId" FROM "wallets";
DROP TABLE "wallets";
ALTER TABLE "new_wallets" RENAME TO "wallets";
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
