-- CreateScanCursors migration
CREATE TABLE "scan_cursors" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastBlock" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Already using @map, so index name matches table name
-- No additional indexes needed for this singleton table

-- Insert initial cursor row
INSERT INTO "scan_cursors" ("id", "lastBlock", "updatedAt") VALUES ('singleton', 0, CURRENT_TIMESTAMP);
