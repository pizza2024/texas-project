-- Create ClubInviteCode table
CREATE TABLE "club_invite_codes" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "club_invite_codes_pkey" PRIMARY KEY ("id")
);

-- Add relation fields to existing tables
ALTER TABLE "club_invite_codes" ADD CONSTRAINT "club_invite_codes_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_invite_codes" ADD CONSTRAINT "club_invite_codes_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint on code
CREATE UNIQUE INDEX "club_invite_codes_code_key" ON "club_invite_codes"("code");

-- Add indexes
CREATE INDEX "club_invite_codes_clubId_idx" ON "club_invite_codes"("clubId");
CREATE INDEX "club_invite_codes_code_idx" ON "club_invite_codes"("code");

-- Add clubInviteCodes relation to users (handled by Prisma, but noted for reference)
-- The relation "ClubInviteCreator" on User is already handled via Prisma schema

-- Add inviteCodes relation to Club (handled by Prisma, but noted for reference)
-- The relation on Club is already handled via Prisma schema
