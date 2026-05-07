-- Create Club tables (missing base migration)

CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "minElo" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 100,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "club_members" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "club_chats" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_chats_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX "clubs_ownerId_idx" ON "clubs"("ownerId");
CREATE INDEX "club_members_clubId_idx" ON "club_members"("clubId");
CREATE INDEX "club_members_userId_idx" ON "club_members"("userId");
CREATE INDEX "club_chats_clubId_idx" ON "club_chats"("clubId");

-- Add foreign keys
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_members" ADD CONSTRAINT "club_members_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_members" ADD CONSTRAINT "club_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_chats" ADD CONSTRAINT "club_chats_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_chats" ADD CONSTRAINT "club_chats_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
