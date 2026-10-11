import { makeContentUrl, makeStaleSlugRedirect } from "@/lib/content-url";

export function getAlbumUrl(shortId: string, slug?: string | null): string {
  return makeContentUrl("gallery", shortId, slug);
}

/**
 * Canonical-slug redirect for the album detail route.
 *
 * Albums are looked up by their permanent `shortId`, so the slug segment is
 * cosmetic — an old slug (e.g. after retitling) still resolves. When the
 * URL's slug doesn't match the current slug, return the canonical path to
 * redirect to; otherwise return `null` (no redirect).
 */
export function getStaleAlbumSlugRedirect(
  providedSlug: string | undefined,
  shortId: string,
  currentSlug: string | null,
): string | null {
  return makeStaleSlugRedirect("gallery", providedSlug, shortId, currentSlug);
}
