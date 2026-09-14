import { EXPLICIT_LOCALE_COOKIE, EXPLICIT_LOCALE_MAX_AGE, persistExplicitLocale } from "@/lib/locale-choice";

describe("persistExplicitLocale", () => {
  it("writes the explicit choice cookie", () => {
    let last = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (value: string) => {
        last = value;
      },
    });

    try {
      persistExplicitLocale("sk");
      expect(last).toBe(
        `${EXPLICIT_LOCALE_COOKIE}=sk;path=/;max-age=${EXPLICIT_LOCALE_MAX_AGE};samesite=lax`,
      );
    } finally {
      delete (document as { cookie?: unknown }).cookie;
    }
  });
});
