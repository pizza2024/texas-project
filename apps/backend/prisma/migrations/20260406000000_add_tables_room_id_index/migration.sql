-- Add missing index on tables.roomId for efficient lookups during getTable fallback
CREATE INDEX IF NOT EXISTS "tables_roomId_idx" ON "tables"("roomId");
