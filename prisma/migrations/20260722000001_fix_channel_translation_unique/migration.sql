-- Add missing unique constraint on normalizedName (schema says @unique but
-- 20260722000000_add_channel_translations forgot to create it).
-- Also drop the DEFAULT '' that was only needed for the INSERT backfill
-- and is not declared in the Prisma schema.
ALTER TABLE "ChannelTranslation" ADD CONSTRAINT "ChannelTranslation_normalizedName_key" UNIQUE ("normalizedName");
ALTER TABLE "ChannelTranslation" ALTER COLUMN "normalizedName" DROP DEFAULT;
