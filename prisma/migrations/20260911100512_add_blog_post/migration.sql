-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "excerpt" TEXT,
    "content" TEXT,
    "coverUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_shortId_key" ON "BlogPost"("shortId");

-- CreateIndex
CREATE INDEX "BlogPost_channelId_idx" ON "BlogPost"("channelId");

-- CreateIndex
CREATE INDEX "BlogPost_isPublic_publishedAt_createdAt_idx" ON "BlogPost"("isPublic", "publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "BlogPost_language_isPublic_createdAt_idx" ON "BlogPost"("language", "isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "BlogPost_createdAt_id_idx" ON "BlogPost"("createdAt", "id");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
