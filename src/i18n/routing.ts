import { defineRouting } from "next-intl/routing";

export const locales = ["en", "cs", "sk"] as const;
export type Locale = (typeof locales)[number];

export const localeFlags: Record<string, string> = {
  en: "🇬🇧",
  cs: "🇨🇿",
  sk: "🇸🇰",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: {
    name: "NEXT_LOCALE",
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  },
});
