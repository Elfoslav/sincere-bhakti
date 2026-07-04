import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "cs", "sk"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});
