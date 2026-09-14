"use client";

import { useEffect } from "react";

export default function LangSetter({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    // Keep next-intl's own NEXT_LOCALE cookie in sync on client-side
    // navigations the middleware may skip due to the router cache. This only
    // mirrors the rendered locale — the explicit switcher pick lives in
    // SB_LOCALE_CHOICE and is never written here.
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
  }, [locale]);

  return null;
}