-- CreateEnum
CREATE TYPE "ChannelRole" AS ENUM ('owner', 'editor');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelEditor" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChannelRole" NOT NULL DEFAULT 'editor',

    CONSTRAINT "ChannelEditor_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE INDEX "Channel_ownerId_idx" ON "Channel"("ownerId");

-- CreateIndex
CREATE INDEX "Post_channelId_idx" ON "Post"("channelId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEditor" ADD CONSTRAINT "ChannelEditor_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEditor" ADD CONSTRAINT "ChannelEditor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
