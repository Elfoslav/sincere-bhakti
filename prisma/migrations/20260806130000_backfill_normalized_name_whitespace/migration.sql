-- Backfill: re-normalize stored normalized names to match the updated
-- normalizeName(), which now collapses internal whitespace runs (spaces, tabs,
-- newlines) to a single space, in addition to trimming, folding diacritics, and
-- lowercasing.
--
-- Diacritics were already folded and the value lowercased when each row was
-- written (the only change is whitespace collapsing), and whitespace-collapse
-- commutes with diacritic-folding/lowercasing — so re-collapsing the STORED
-- value is equivalent to re-normalizing from the original name. No `unaccent`
-- extension is required.
--
-- Safety: this cannot violate @@unique([language, normalizedName]). Any two
-- names that differ only by whitespace also produce the same slug (slugify
-- collapses whitespace to dashes identically), and @@unique([language, slug])
-- already prevents two such rows from coexisting in the same language.
--
-- Only rows whose value actually changes are touched.

UPDATE "ChannelTranslation"
SET "normalizedName" = btrim(regexp_replace("normalizedName", '\s+', ' ', 'g'))
WHERE "normalizedName" <> btrim(regexp_replace("normalizedName", '\s+', ' ', 'g'));

UPDATE "ChannelSlugHistory"
SET "oldNormalizedName" = btrim(regexp_replace("oldNormalizedName", '\s+', ' ', 'g'))
WHERE "oldNormalizedName" <> btrim(regexp_replace("oldNormalizedName", '\s+', ' ', 'g'));
