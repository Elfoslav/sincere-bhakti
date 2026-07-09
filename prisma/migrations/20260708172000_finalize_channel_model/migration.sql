-- Drop old foreign keys
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_authorId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_channelId_fkey";

-- Drop index on authorId
DROP INDEX IF EXISTS "Post_authorId_idx";

-- Create personal channels for existing users who don't have one yet,
-- so the backfill below can link posts and the SET NOT NULL succeeds.
INSERT INTO "Channel" ("id", "name", "slug", "ownerId")
SELECT
  'channel-' || u."id",
  u."name",
  'user-' || u."id",
  u."id"
FROM "User" u
WHERE u."id" NOT IN (SELECT "ownerId" FROM "Channel");

-- Backfill channelId for existing posts that still have NULL.
-- Maps each post's authorId to their personal channel.
UPDATE "Post"
SET "channelId" = (
  SELECT "Channel"."id"
  FROM "Channel"
  WHERE "Channel"."ownerId" = "Post"."authorId"
  LIMIT 1
)
WHERE "Post"."channelId" IS NULL;

-- Drop the authorId column
ALTER TABLE "Post" DROP COLUMN "authorId";

-- Make channelId required (safe now because we backfilled above)
ALTER TABLE "Post" ALTER COLUMN "channelId" SET NOT NULL;

-- Re-add channelId FK with CASCADE delete
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
