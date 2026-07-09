-- Create personal channels for existing users who don't have one yet.
-- This is safe to run on any database — skips users who already have a channel.
INSERT INTO "Channel" ("id", "name", "slug", "ownerId")
SELECT
  'channel-' || u."id",
  u."name",
  'user-' || u."id",
  u."id"
FROM "User" u
WHERE u."id" NOT IN (SELECT "ownerId" FROM "Channel");
