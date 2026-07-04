-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE INDEX "Post_language_isPublic_createdAt_idx" ON "Post"("language", "isPublic", "createdAt");
