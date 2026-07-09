-- Drop old foreign keys
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_authorId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_channelId_fkey";

-- Drop index on authorId
DROP INDEX IF EXISTS "Post_authorId_idx";

-- Drop the authorId column
ALTER TABLE "Post" DROP COLUMN "authorId";

-- Make channelId required
ALTER TABLE "Post" ALTER COLUMN "channelId" SET NOT NULL;

-- Re-add channelId FK with CASCADE delete
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
