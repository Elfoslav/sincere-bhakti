-- DropIndex
DROP INDEX "Channel_ownerId_idx";

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "isPersonal" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark each user's earliest channel (by createdAt) as their personal channel
UPDATE "Channel" SET "isPersonal" = true
WHERE id IN (
  SELECT DISTINCT ON ("ownerId") id
  FROM "Channel"
  ORDER BY "ownerId", "createdAt" ASC
);

-- CreateIndex
CREATE INDEX "Channel_ownerId_isPersonal_idx" ON "Channel"("ownerId", "isPersonal");
