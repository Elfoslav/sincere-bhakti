export type ContentKind = "posts" | "blog";

export function makeContentUrl(kind: ContentKind, shortId: string, slug?: string | null): string {
  return slug ? `/${kind}/${shortId}/${slug}` : `/${kind}/${shortId}`;
}

/**
 * Canonical-slug redirect for a detail route.
 *
 * Rows are looked up by their permanent `shortId`, so the slug segment in the
 * URL is cosmetic — an old slug (e.g. after an edit/retitle) still resolves.
 * When the URL's slug doesn't match the current slug, return the canonical
 * path to redirect to; otherwise return `null` (no redirect).
 *
 * `providedSlug` is `undefined` when the URL had no slug segment at all
 * (a bare `/{kind}/{shortId}` is accepted as-is and not force-redirected).
 */
export function makeStaleSlugRedirect(
  kind: ContentKind,
  providedSlug: string | undefined,
  shortId: string,
  currentSlug: string | null,
): string | null {
  if (providedSlug === undefined) return null;
  if (providedSlug === currentSlug) return null;
  return makeContentUrl(kind, shortId, currentSlug);
}
