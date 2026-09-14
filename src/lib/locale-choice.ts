import { locales, routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

// Written ONLY by the language switcher when the user explicitly picks a
// language. next-intl's own NEXT_LOCALE cookie cannot serve this purpose: the
// middleware and LangSetter also write it on auto-detected or prefixed visits,
// so its presence doesn't prove the user chose.
export const EXPLICIT_LOCALE_COOKIE = "SB_LOCALE_CHOICE";

export const EXPLICIT_LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

const prefixedLocales = locales.filter((locale) => locale !== routing.defaultLocale);

const PREFIX_PATTERN = new RegExp(`^/(${prefixedLocales.join("|")})(/|$)`);

export function parseExplicitLocale(value: unknown): Locale | null {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

// Client-side only: call from the language switcher to freeze auto-detection.
export function persistExplicitLocale(locale: Locale): void {
  document.cookie = `${EXPLICIT_LOCALE_COOKIE}=${locale};path=/;max-age=${EXPLICIT_LOCALE_MAX_AGE};samesite=lax`;
}

export function getPathLocale(pathname: string): Locale | null {
  const match = pathname.match(PREFIX_PATTERN);
  return match ? (match[1] as Locale) : null;
}

// Where an explicitly-chosen locale wants an unprefixed URL to go. Returns
// null when no redirect is needed: the URL already carries a locale prefix (a
// direct link wins over the stored choice) or the choice is the default
// locale, which has no prefix under `as-needed`.
export function explicitRedirectPath(pathname: string, explicit: Locale): string | null {
  if (explicit === routing.defaultLocale || getPathLocale(pathname)) return null;
  return `/${explicit}${pathname === "/" ? "" : pathname}`;
}
