import { headers } from "next/headers";
import sharp from "sharp";
import { getCachedPostById } from "@/lib/services/post";
import { getSiteUrl } from "@/lib/url";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { POST_OG_IMAGE, OG_POST_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL, OG_IMAGE_TRANSIENT_CACHE_CONTROL } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti post image";
export const size = { width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height };
// JPEG, not PNG: WhatsApp silently drops link-preview images over ~600 KB,
// and a photo re-encoded as PNG (what Satori/ImageResponse always outputs)
// easily exceeds 1.5 MB. A quality-80 JPEG of the same frame is ~100–250 KB.
export const contentType = POST_OG_IMAGE.type;
export const MAX_OG_IMAGE_BYTES = 10 * 1024 * 1024;

const JPEG_QUALITY = 80;
const IVORY = "#fdf8ee";

function parseContentLength(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentLength = parseContentLength(res.headers.get("content-length"));
    if (contentLength !== null && contentLength > MAX_OG_IMAGE_BYTES) return null;

    if (!res.body) return null;

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_OG_IMAGE_BYTES) {
          controller.abort();
          return null;
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks, totalBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function jpegResponse(buffer: Buffer, cacheControl = OG_POST_IMAGE_CACHE_CONTROL): Response {
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheControl },
  });
}

// Warm ivory canvas with the logo large and centered (550px tall at the
// logo's exact 603×414 aspect ratio → 801px wide). The logo is
// dark-ink-on-transparent, so the light brand ground gives it full contrast.
// cacheControl varies by WHY we're falling back: missing/undecodable entity is
// cacheable for that URL (short TTL); a rate-limit hit is transient per-IP
// state that must not be shared-cached (see OG_IMAGE_RATE_LIMITED_CACHE_CONTROL).
async function logoFallback(
  siteUrl: string,
  cacheControl: string = OG_IMAGE_FALLBACK_CACHE_CONTROL,
): Promise<Response> {
  const canvas = sharp({
    create: { width: 1200, height: 630, channels: 3, background: IVORY },
  });

  const logo = await fetchImageBuffer(`${siteUrl}/images/sincere-bhakti-logo.png`);
  if (!logo) {
    // Last resort: plain ivory frame — still a valid preview image.
    return jpegResponse(await canvas.jpeg({ quality: JPEG_QUALITY }).toBuffer(), cacheControl);
  }

  const resizedLogo = await sharp(logo).resize(801, 550, { fit: "inside" }).png().toBuffer();
  const buffer = await canvas
    .composite([{ input: resizedLogo }]) // gravity defaults to centre
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return jpegResponse(buffer, cacheControl);
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const siteUrl = getSiteUrl();
  const ip = getClientIp(await headers());

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPostOgImage, ip, RATE_LIMITS.readPostOgImage.limit, RATE_LIMITS.readPostOgImage.windowMs)) {
    return logoFallback(siteUrl, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL);
  }

  const post = await getCachedPostById(id, locale);

  // Post image available: show it full-bleed with nothing layered on top.
  // Otherwise (no post, private, no image, or fetch failed): logo fallback.
  // Prefer a landscape image — the 1200×630 cover crop cuts it the least.
  const images =
    post && post.isPublic ? post.media.filter((m) => m.type === "image" && m.url) : [];
  const bestImage =
    images.find((m) => m.width && m.height && m.width >= m.height) ?? images[0] ?? null;

  // No post, private, or genuinely imageless: the logo IS the correct response
  // for this URL, so it may be briefly shared-cached.
  if (!bestImage) {
    return logoFallback(siteUrl, OG_IMAGE_FALLBACK_CACHE_CONTROL);
  }

  // The post HAS an image but we couldn't fetch or decode it — likely transient
  // (upstream timeout/5xx, truncated/oversized stream, bad bytes). Fall back but
  // do NOT shared-cache it, so a blip can't pin the logo on a real post's card.
  const original = await fetchImageBuffer(bestImage.url);
  if (!original) {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }

  try {
    const buffer = await sharp(original)
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    // Short TTL, no long SWR: bounds how long a now-private / media-changed post
    // can serve a stale photo from the shared cache (see OG_POST_IMAGE_CACHE_CONTROL).
    return jpegResponse(buffer, OG_POST_IMAGE_CACHE_CONTROL);
  } catch {
    return logoFallback(siteUrl, OG_IMAGE_TRANSIENT_CACHE_CONTROL);
  }
}
