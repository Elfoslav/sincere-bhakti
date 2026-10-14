-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumItem" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AlbumItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Album_shortId_key" ON "Album"("shortId");

-- CreateIndex
CREATE INDEX "Album_channelId_idx" ON "Album"("channelId");

-- CreateIndex
CREATE INDEX "Album_isPublic_createdAt_idx" ON "Album"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "Album_language_isPublic_createdAt_idx" ON "Album"("language", "isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "Album_createdAt_id_idx" ON "Album"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AlbumItem_albumId_idx" ON "AlbumItem"("albumId");

-- CreateIndex
CREATE INDEX "AlbumItem_userId_idx" ON "AlbumItem"("userId");

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumItem" ADD CONSTRAINT "AlbumItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumItem" ADD CONSTRAINT "AlbumItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
