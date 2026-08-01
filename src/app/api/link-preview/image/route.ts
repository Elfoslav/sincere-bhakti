import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/validation";
import { fetchRemoteBytes, MAX_LINK_PREVIEW_IMAGE_BYTES } from "@/lib/remote-fetch";
import { ERROR_BAD_REQUEST, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";

// Proxies a link-preview og:image so browsers can render it under the app's
// img-src 'self' CSP. The image URL is user-supplied, so it goes through the
// same SSRF + size guards as the page fetch.

const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

function contentTypeFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    if (/\.png$/i.test(pathname)) return "image/png";
    if (/\.webp$/i.test(pathname)) return "image/webp";
    if (/\.gif$/i.test(pathname)) return "image/gif";
    if (/\.svg$/i.test(pathname)) return "image/svg+xml";
  } catch {
    // fall through
  }
  return "image/jpeg";
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readLinkPreviewImage, ip, RATE_LIMITS.readLinkPreviewImage.limit, RATE_LIMITS.readLinkPreviewImage.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();
  if (!url || !isSafeHttpUrl(url)) {
    return NextResponse.json({ error: ERROR_BAD_REQUEST }, { status: HTTP_BAD_REQUEST });
  }

  try {
    const bytes = await fetchRemoteBytes(url, { maxBytes: MAX_LINK_PREVIEW_IMAGE_BYTES });
    if (!bytes) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypeFromUrl(url),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    return serverError("GET /api/link-preview/image", error);
  }
}
