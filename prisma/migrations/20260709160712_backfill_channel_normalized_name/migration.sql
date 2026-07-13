-- Backfill normalizedName for existing channels.
-- Uses plpgsql to strip combining diacritical marks via NFD normalization.
-- Falls back to lowercased raw name if the regex produces empty string.

CREATE OR REPLACE FUNCTION normalize_channel_name(name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        NORMALIZE(name, NFD),
        '[\u0300-\u036f]',
        '',
        'g'
      ),
      '[^a-z0-9 ]',
      '',
      'g'
    )
  );
  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Channel"
SET "normalizedName" = normalize_channel_name("name")
WHERE "normalizedName" = '';

DROP FUNCTION normalize_channel_name;