-- CreateTable
CREATE TABLE "ChannelSlugHistory" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "oldNormalizedName" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelSlugHistory_oldSlug_key" ON "ChannelSlugHistory"("oldSlug");

-- CreateIndex
CREATE INDEX "ChannelSlugHistory_channelId_idx" ON "ChannelSlugHistory"("channelId");

-- CreateIndex
CREATE INDEX "ChannelSlugHistory_oldNormalizedName_idx" ON "ChannelSlugHistory"("oldNormalizedName");

-- AddForeignKey
ALTER TABLE "ChannelSlugHistory" ADD CONSTRAINT "ChannelSlugHistory_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
