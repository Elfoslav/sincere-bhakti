-- CreateIndex
CREATE INDEX "Channel_createdAt_id_idx" ON "Channel"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_createdAt_id_idx" ON "Post"("createdAt", "id");
