import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";
import { getPostUrl } from "@/lib/post-url";

// Reproduces the URL construction logic from PostCard.handleCopyLink so the
// locale-prefix behaviour is tested independently of rendering the full component.
function buildCopyLinkUrl(origin: string, locale: string, shortId: string, slug: string | null | undefined): string {
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${origin}${localePrefix}${getPostUrl(shortId, slug)}`;
}

const ORIGIN = "https://sincere-bhakti.com";
const SHORT_ID = "abc12345";
const SLUG = "krishna-consciousness";

describe("PostCard copy-link URL", () => {
  it("omits the locale prefix for the default locale (en)", () => {
    expect(buildCopyLinkUrl(ORIGIN, "en", SHORT_ID, SLUG)).toBe(
      `${ORIGIN}/posts/${SHORT_ID}/${SLUG}`,
    );
  });

  it("includes the locale prefix for non-default locales", () => {
    expect(buildCopyLinkUrl(ORIGIN, "cs", SHORT_ID, SLUG)).toBe(
      `${ORIGIN}/cs/posts/${SHORT_ID}/${SLUG}`,
    );
    expect(buildCopyLinkUrl(ORIGIN, "sk", SHORT_ID, SLUG)).toBe(
      `${ORIGIN}/sk/posts/${SHORT_ID}/${SLUG}`,
    );
  });

  it("works without a slug segment", () => {
    expect(buildCopyLinkUrl(ORIGIN, "en", SHORT_ID, null)).toBe(
      `${ORIGIN}/posts/${SHORT_ID}`,
    );
    expect(buildCopyLinkUrl(ORIGIN, "cs", SHORT_ID, null)).toBe(
      `${ORIGIN}/cs/posts/${SHORT_ID}`,
    );
  });
});
