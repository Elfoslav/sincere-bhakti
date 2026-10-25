-- Feed search (?q=) uses case-insensitive substring matching (ILIKE '%term%'),
-- which cannot use a btree. pg_trigm GIN indexes keep it from sequentially
-- scanning every post and article as the tables grow.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Post_content_idx" ON "Post" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "BlogPost_title_idx" ON "BlogPost" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "BlogPost_excerpt_idx" ON "BlogPost" USING GIN ("excerpt" gin_trgm_ops);
