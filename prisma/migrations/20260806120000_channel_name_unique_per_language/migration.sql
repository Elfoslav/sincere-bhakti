-- Channel names and slugs become unique PER LANGUAGE instead of globally.
-- A single channel can now reuse the same name/slug across its language
-- translations (e.g. an "en" and a "cs" translation both named "Devotees").
-- Two different channels still cannot share a name/slug within the same
-- language. Cross-language name ownership (a name belongs to one channel across
-- ALL languages, and only that channel may reuse it) is enforced in application
-- code, not by these database constraints.

-- Drop the global unique on normalizedName. Depending on how the database was
-- built, this uniqueness may exist as a table CONSTRAINT (migration-built DBs,
-- via ADD CONSTRAINT) or as a plain unique INDEX (db-push'd dev DBs). Handle
-- both so the migration applies cleanly everywhere.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelTranslation_normalizedName_key') THEN
    ALTER TABLE "ChannelTranslation" DROP CONSTRAINT "ChannelTranslation_normalizedName_key";
  ELSE
    DROP INDEX IF EXISTS "ChannelTranslation_normalizedName_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelTranslation_slug_key') THEN
    ALTER TABLE "ChannelTranslation" DROP CONSTRAINT "ChannelTranslation_slug_key";
  ELSE
    DROP INDEX IF EXISTS "ChannelTranslation_slug_key";
  END IF;
END $$;

CREATE UNIQUE INDEX "ChannelTranslation_language_normalizedName_key" ON "ChannelTranslation"("language", "normalizedName");
CREATE UNIQUE INDEX "ChannelTranslation_language_slug_key" ON "ChannelTranslation"("language", "slug");

-- ChannelSlugHistory: add `language`, then make oldSlug unique per language.
-- Backfill existing rows with their channel's default language.
ALTER TABLE "ChannelSlugHistory" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
UPDATE "ChannelSlugHistory" h SET "language" = c."defaultLanguage" FROM "Channel" c WHERE h."channelId" = c."id";
ALTER TABLE "ChannelSlugHistory" ALTER COLUMN "language" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelSlugHistory_oldSlug_key') THEN
    ALTER TABLE "ChannelSlugHistory" DROP CONSTRAINT "ChannelSlugHistory_oldSlug_key";
  ELSE
    DROP INDEX IF EXISTS "ChannelSlugHistory_oldSlug_key";
  END IF;
END $$;

CREATE UNIQUE INDEX "ChannelSlugHistory_language_oldSlug_key" ON "ChannelSlugHistory"("language", "oldSlug");
CREATE INDEX "ChannelSlugHistory_language_idx" ON "ChannelSlugHistory"("language");
