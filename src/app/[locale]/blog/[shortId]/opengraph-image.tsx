import { headers } from "next/headers";
import { getCachedBlogPostByShortId, isBlogPubliclyVisible } from "@/lib/services/blog";
import { getSiteUrl } from "@/lib/url";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { POST_OG_IMAGE, OG_POST_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL, OG_IMAGE_TRANSIENT_CACHE_CONTROL } from "@/lib/seo";
import { fetchImageBuffer, ogJpegResponse, logoFallback, coverCropToJpeg } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti blog image";
export const size = { width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height };
// JPEG, not PNG: WhatsApp silently drops link-preview images over ~600 KB,
// and a cover re-encoded as PNG (what Satori/ImageResponse always outputs)
// easily exceeds 1.5 MB. A quality-80 JPEG of the same frame is ~100–250 KB.
export const contentType = POST_OG_IMAGE.type;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; shortId: string }>;
}) {
  const { shortId, locale } = await params;
  const siteUrl = getSiteUrl();
  const ip = getClientIp(await headers());

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogOgImage, ip, RATE_LIMITS.readBlogOgImage.limit, RATE_LIMITS.readBlogOgImage.windowMs)) {
    return logoFallback(siteUrl, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL);
  }

  // Guarded: a missing/undefined param or a lookup error must never throw
  // here — OG routes return the logo fallback, never a 500 (crawlers cache
  // failures for weeks).
  let post: Awaited<ReturnType<typeof getCachedBlogPostByShortId>> = null;
  if (shortId) {
    try {
      post = await getCachedBlogPostByShortId(shortId, locale);
    } catch {
      post = null;
    }
  }

  // Cover available on a publicly visible post: show it full-bleed. Private,
  // scheduled, missing, or coverless posts get the logo fallback.
  const coverUrl = post && isBlogPubliclyVisible(post) ? post.coverUrl : null;

  // Genuinely imageless for this URL: the logo IS the correct response, so it
  // may be briefly shared-cached.
  if (!coverUrl) {
    return logoFallback(siteUrl, OG_IMAGE_FALLBACK_CACHE_CONTROL);
  }

  // The post HAS a cover but we couldn't fetch or decode it — likely transient
  // (upstream timeout/5xx, truncated/oversized stream, bad bytes). Fall back but
  // do NOT shared-cache it, so a blip can't pin the logo on a real cover.
  const original = await fetchImageBuffer(coverUrl);
  if (!original) {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }

  const buffer = await coverCropToJpeg(original);
  if (!buffer) {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }
  // Short TTL, no long SWR: bounds how long a now-private / cover-changed post
  // can serve a stale photo from the shared cache (see OG_POST_IMAGE_CACHE_CONTROL).
  return ogJpegResponse(buffer, OG_POST_IMAGE_CACHE_CONTROL);
}
