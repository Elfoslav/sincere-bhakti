-- Create ChannelTranslation table
CREATE TABLE "ChannelTranslation" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,

    CONSTRAINT "ChannelTranslation_pkey" PRIMARY KEY ("id")
);

-- Add defaultLanguage column to Channel (nullable initially for data migration)
ALTER TABLE "Channel" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'en';

-- Copy existing channel names/slugs to translations (as English)
INSERT INTO "ChannelTranslation" ("id", "channelId", "language", "name", "normalizedName", "slug")
SELECT
    gen_random_uuid()::text,
    "id",
    'en',
    "name",
    "normalizedName",
    "slug"
FROM "Channel";

-- Now drop the old columns
ALTER TABLE "Channel" DROP COLUMN "name";
ALTER TABLE "Channel" DROP COLUMN "normalizedName";
ALTER TABLE "Channel" DROP COLUMN "slug";

-- ChannelTranslation constraints and indexes
ALTER TABLE "ChannelTranslation" ADD CONSTRAINT "ChannelTranslation_channelId_language_key" UNIQUE ("channelId", "language");
ALTER TABLE "ChannelTranslation" ADD CONSTRAINT "ChannelTranslation_slug_key" UNIQUE ("slug");
ALTER TABLE "ChannelTranslation" ADD CONSTRAINT "ChannelTranslation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ChannelTranslation_language_idx" ON "ChannelTranslation"("language");
CREATE INDEX "ChannelTranslation_channelId_idx" ON "ChannelTranslation"("channelId");
