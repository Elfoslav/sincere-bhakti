import sharp from "sharp";
import { getSiteUrl } from "@/lib/url";
import { MAX_IMAGE_INPUT_PIXELS } from "@/lib/validation";
import {
  OG_IMAGE_FALLBACK_CACHE_CONTROL,
  OG_POST_IMAGE_CACHE_CONTROL,
} from "@/lib/seo";

// Cap on fetched upstream bytes: aborts the stream past this point so a
// malicious/huge image can't OOM the route.
export const MAX_OG_IMAGE_BYTES = 10 * 1024 * 1024;

export const OG_JPEG_QUALITY = 80;
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

export function ogJpegResponse(buffer: Buffer, cacheControl = OG_POST_IMAGE_CACHE_CONTROL): Response {
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
export async function logoFallback(
  siteUrl: string = getSiteUrl(),
  cacheControl: string = OG_IMAGE_FALLBACK_CACHE_CONTROL,
): Promise<Response> {
  const canvas = sharp({
    create: { width: 1200, height: 630, channels: 3, background: IVORY },
  });

  const logo = await fetchImageBuffer(`${siteUrl}/images/sincere-bhakti-logo.png`);
  if (!logo) {
    // Last resort: plain ivory frame — still a valid preview image.
    return ogJpegResponse(await canvas.jpeg({ quality: OG_JPEG_QUALITY }).toBuffer(), cacheControl);
  }

  const resizedLogo = await sharp(logo, { limitInputPixels: MAX_IMAGE_INPUT_PIXELS }).resize(801, 550, { fit: "inside" }).png().toBuffer();
  const buffer = await canvas
    .composite([{ input: resizedLogo }]) // gravity defaults to centre
    .jpeg({ quality: OG_JPEG_QUALITY })
    .toBuffer();
  return ogJpegResponse(buffer, cacheControl);
}

/**
 * Render a fetched upstream image as a 1200×630 cover-cropped JPEG suitable
 * for og:image (<600 KB for WhatsApp/Messenger). Returns null when the bytes
 * can't be decoded — the caller falls back with TRANSIENT (no shared cache).
 */
export async function coverCropToJpeg(image: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(image, { limitInputPixels: MAX_IMAGE_INPUT_PIXELS })
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: OG_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}
