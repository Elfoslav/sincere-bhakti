export function getPostUrl(shortId: string, slug?: string | null): string {
  return slug ? `/posts/${shortId}/${slug}` : `/posts/${shortId}`;
}

/**
 * Canonical-slug redirect for the post detail route.
 *
 * Posts are looked up by their permanent `shortId`, so the slug segment in the
 * URL is cosmetic — an old slug (e.g. after the post's text was edited) still
 * resolves. When the URL's slug doesn't match the post's current slug, return
 * the canonical path to redirect to; otherwise return `null` (no redirect).
 *
 * `providedSlug` is `undefined` when the URL had no slug segment at all
 * (a bare `/posts/{shortId}` is accepted as-is and not force-redirected).
 */
export function getStalePostSlugRedirect(
  providedSlug: string | undefined,
  shortId: string,
  currentSlug: string | null,
): string | null {
  if (providedSlug === undefined) return null;
  if (providedSlug === currentSlug) return null;
  return getPostUrl(shortId, currentSlug);
}
