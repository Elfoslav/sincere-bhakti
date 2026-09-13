-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_isPublic_publishedAt_createdAt_idx" ON "Post"("isPublic", "publishedAt", "createdAt");
