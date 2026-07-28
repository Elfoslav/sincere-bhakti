-- Add Post.shortId (public short URL id) and Post.slug (optional pretty slug).
-- Fully self-contained so it runs automatically via `prisma migrate deploy`
-- (no separate backfill script needed). Safe on populated tables: add the
-- columns nullable, backfill, then enforce NOT NULL + UNIQUE.
--
-- The backfill reproduces prisma/backfill-post-shortid.ts exactly:
--   shortId = crypto.randomUUID().slice(0, 8)  -> 8 lowercase hex chars
--   slug    = content, lowercased, non-alphanumerics collapsed to "-",
--             leading/trailing "-" trimmed, truncated to POST_SLUG_MAX_LENGTH
--             (60) chars at a word boundary (NULL if empty)

-- Step 1: add both columns nullable so the ALTER succeeds on populated tables.
ALTER TABLE "Post" ADD COLUMN "shortId" TEXT;
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;

-- Step 2a: backfill slug (best-effort legacy backfill). Folds diacritics (NFD
-- decomposition + strip combining marks U+0300-U+036F, matching stripDiacritics
-- in validation.ts, e.g. "když"->"kdyz"), lowercases, collapses non-alphanumeric
-- runs to dashes, and cuts back to a word boundary at 60 chars. The application's
-- derivePostSlug is authoritative and additionally prefers sentence boundaries;
-- editing a post recomputes its slug with that logic. NULL content or a value
-- that reduces to empty stays NULL.
UPDATE "Post" p
SET "slug" = NULLIF(
  CASE
    WHEN length(b.base) <= 60 THEN b.base
    ELSE regexp_replace(left(b.base, 60), '-[^-]*$', '')
  END,
  ''
)
FROM (
  SELECT "id",
    TRIM(BOTH '-' FROM regexp_replace(
      regexp_replace(normalize(lower(TRIM("content")), NFD), '[̀-ͯ]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'
    )) AS base
  FROM "Post"
  WHERE "content" IS NOT NULL
) b
WHERE p."id" = b."id";

-- Step 2b: backfill shortId with the same 8-hex format the app generates
-- (first 8 chars of a UUID). Looped so a value that happens to collide with an
-- already-assigned one is regenerated, guaranteeing the UNIQUE index below
-- never fails on this data.
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
BEGIN
  FOR r IN SELECT "id" FROM "Post" WHERE "shortId" IS NULL LOOP
    LOOP
      candidate := substr(gen_random_uuid()::text, 1, 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Post" WHERE "shortId" = candidate);
    END LOOP;
    UPDATE "Post" SET "shortId" = candidate WHERE "id" = r."id";
  END LOOP;
END $$;

-- Step 3: enforce the constraints now that every row has a value.
ALTER TABLE "Post" ALTER COLUMN "shortId" SET NOT NULL;
CREATE UNIQUE INDEX "Post_shortId_key" ON "Post"("shortId");
