import { headers } from "next/headers";
import { getCachedPostById, getCachedPostByShortId } from "@/lib/services/post";
import { isPostPubliclyVisible } from "@/lib/blog";
import { getSiteUrl } from "@/lib/url";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { POST_OG_IMAGE, OG_POST_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL, OG_IMAGE_TRANSIENT_CACHE_CONTROL } from "@/lib/seo";
import { fetchImageBuffer, ogJpegResponse, logoFallback, coverCropToJpeg } from "@/lib/og-image";
import { isTrustedMediaUrl } from "@/lib/validation";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti post image";
export const size = { width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height };
// JPEG, not PNG: WhatsApp silently drops link-preview images over ~600 KB,
// and a photo re-encoded as PNG (what Satori/ImageResponse always outputs)
// easily exceeds 1.5 MB. A quality-80 JPEG of the same frame is ~100–250 KB.
export const contentType = POST_OG_IMAGE.type;
export { MAX_OG_IMAGE_BYTES } from "@/lib/og-image";
export { fetchImageBuffer };

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; shortId: string }>;
}) {
  const { shortId, locale } = await params;
  const siteUrl = getSiteUrl();
  const ip = getClientIp(await headers());

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPostOgImage, ip, RATE_LIMITS.readPostOgImage.limit, RATE_LIMITS.readPostOgImage.windowMs)) {
    return logoFallback(siteUrl, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL);
  }

  // Resolve by shortId (the URL segment), falling back to the legacy internal id
  // for old /posts/{id} preview URLs. Guarded: a missing/undefined param or a
  // lookup error must never throw here — OG routes return the logo fallback,
  // never a 500 (crawlers cache failures for weeks).
  let post: Awaited<ReturnType<typeof getCachedPostByShortId>> = null;
  if (shortId) {
    try {
      post = await getCachedPostByShortId(shortId, locale) ?? await getCachedPostById(shortId, locale);
    } catch {
      post = null;
    }
  }

  // Post image available: show it full-bleed with nothing layered on top.
  // Otherwise (no post, private/scheduled, no image, or fetch failed): logo fallback.
  // Prefer a landscape image — the 1200×630 cover crop cuts it the least.
  const images =
    post && isPostPubliclyVisible(post) ? post.media.filter((m) => m.type === "image" && m.url) : [];
  const bestImage =
    images.find((m) => m.width && m.height && m.width >= m.height) ?? images[0] ?? null;

  // Re-validate the stored URL before server-side fetch: write-time checks
  // are fail-closed, but a legacy row or direct DB write must not turn this
  // route into an open SSRF fetcher (e.g. media pointed at 169.254.169.254).
  const storageDomain = process.env.R2_PUBLIC_URL ?? "";
  const trustedBest = bestImage && isTrustedMediaUrl(bestImage.url, "image", storageDomain) ? bestImage : null;

  // No post, private/scheduled, untrusted, or genuinely imageless: the logo IS
  // the correct response for this URL, so it may be briefly shared-cached.
  if (!trustedBest) {
    return logoFallback(siteUrl, OG_IMAGE_FALLBACK_CACHE_CONTROL);
  }

  // The post HAS an image but we couldn't fetch or decode it — likely transient
  // (upstream timeout/5xx, truncated/oversized stream, bad bytes). Fall back but
  // do NOT shared-cache it, so a blip can't pin the logo on a real post's card.
  const original = await fetchImageBuffer(trustedBest.url);
  if (!original) {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }

  const buffer = await coverCropToJpeg(original);
  if (!buffer) {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }
  // Short TTL, no long SWR: bounds how long a now-private / media-changed post
  // can serve a stale photo from the shared cache (see OG_POST_IMAGE_CACHE_CONTROL).
  return ogJpegResponse(buffer, OG_POST_IMAGE_CACHE_CONTROL);
}
