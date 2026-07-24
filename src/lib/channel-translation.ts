export interface TranslationInfo {
  language: string;
  name: string;
  slug: string;
}

export function resolveTranslation(
  translations: TranslationInfo[],
  language: string,
): TranslationInfo | null {
  const exact = translations.find((t) => t.language === language);
  if (exact) return exact;
  // Deterministic fallback: the DB queries feeding this don't guarantee row
  // order, so pick the lowest language code rather than an arbitrary [0] — the
  // same channel must always fall back to the same translation.
  const [first] = [...translations].sort((a, b) => a.language.localeCompare(b.language));
  return first ?? null;
}


