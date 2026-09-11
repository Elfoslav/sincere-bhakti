export function getBlogUrl(shortId: string, slug?: string | null): string {
  return slug ? `/blog/${shortId}/${slug}` : `/blog/${shortId}`;
}

/**
 * Canonical-slug redirect for the blog detail route.
 *
 * Blog posts are looked up by their permanent `shortId`, so the slug segment
 * is cosmetic — an old slug (e.g. after retitling) still resolves. When the
 * URL's slug doesn't match the current slug, return the canonical path to
 * redirect to; otherwise return `null` (no redirect).
 */
export function getStaleBlogSlugRedirect(
  providedSlug: string | undefined,
  shortId: string,
  currentSlug: string | null,
): string | null {
  if (providedSlug === undefined) return null;
  if (providedSlug === currentSlug) return null;
  return getBlogUrl(shortId, currentSlug);
}
