-- Backfill Channel.defaultLanguage from the channel's sole translation.
-- defaultLanguage was never set at creation (always "en"), so channels
-- created in another language carry the wrong value. The sole translation of
-- a single-translation channel is necessarily its working language; the lock
-- for profile-managed (personal default-language) translations and the
-- profile-rename propagation both target it. Scoped to single-translation
-- channels only: with several translations there is no timestamp to tell
-- which was created first, and those rows are unaffected by the new rules.
UPDATE "Channel" AS c
SET "defaultLanguage" = t."language"
FROM "ChannelTranslation" AS t
WHERE t."channelId" = c."id"
  AND c."defaultLanguage" <> t."language"
  AND (SELECT COUNT(*) FROM "ChannelTranslation" WHERE "channelId" = c."id") = 1;
