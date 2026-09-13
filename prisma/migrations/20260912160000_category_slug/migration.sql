-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "slug" TEXT;

-- Backfill slugs from names (mirrors deriveCategorySlug for realistic
-- names: lowercase, non-alphanumeric runs to dashes, trimmed).
UPDATE "Category" SET "slug" = regexp_replace(regexp_replace(lower("name"), '[^a-z0-9\s]+', '-', 'g'), '\s+', '-', 'g');
UPDATE "Category" SET "slug" = regexp_replace("slug", '(^-+|-+$)', '', 'g');
UPDATE "Category" SET "slug" = 'category' WHERE "slug" = '';

-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Category_language_slug_key" ON "Category"("language", "slug");
