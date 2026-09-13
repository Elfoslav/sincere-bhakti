-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- DropIndex
DROP INDEX "Category_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Category_language_name_key" ON "Category"("language", "name");

-- CreateIndex
CREATE INDEX "Category_language_idx" ON "Category"("language");
