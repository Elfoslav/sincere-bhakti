"use client";

import { useEffect } from "react";

export default function LangSetter({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    // Persist the active locale so the non-localized root layout (which has no
    // access to the [locale] route param and there is no middleware) can resolve
    // it on subsequent SSR loads and render initial identity data in the right
    // language. Mirrors next-intl's own NEXT_LOCALE cookie convention.
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
  }, [locale]);

  return null;
}