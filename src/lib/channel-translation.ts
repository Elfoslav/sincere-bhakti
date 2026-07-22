export interface TranslationInfo {
  language: string;
  name: string;
  slug: string;
}

export function resolveTranslation(
  translations: TranslationInfo[],
  language: string,
): TranslationInfo | null {
  return translations.find((t) => t.language === language) ?? translations[0] ?? null;
}


