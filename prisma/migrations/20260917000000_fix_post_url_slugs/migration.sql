-- Fix post slugs that were derived from bare URLs (e.g. YouTube links).
-- New logic strips URLs before slugifying and, for URL-only posts, derives the
-- slug from the linked page's title instead. Bare URLs previously produced
-- `https-www-youtube-com-watch-v-...` slugs which are not useful.
-- This migration clears those slugs (stored as NULL = shortId-only URL) so the
-- affected posts return to a clean URL. Titles cannot be fetched in SQL, but
-- editing the post will recompute the slug via the new title-aware path.

UPDATE "Post"
SET "slug" = NULL
WHERE "slug" LIKE 'https-%' OR "slug" LIKE 'http-%';
