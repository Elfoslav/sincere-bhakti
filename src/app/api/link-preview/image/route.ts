import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/validation";
import { fetchRemoteBytes, MAX_LINK_PREVIEW_IMAGE_BYTES } from "@/lib/remote-fetch";
import { ERROR_BAD_REQUEST, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";
import {
  LINK_PREVIEW_IMAGE_CACHE_CONTROL,
  LINK_PREVIEW_RATE_LIMITED_CACHE_CONTROL,
  LINK_PREVIEW_TRANSIENT_CACHE_CONTROL,
} from "@/lib/seo";

// Proxies a link-preview og:image so browsers can render it under the app's
// img-src 'self' CSP. The image URL is user-supplied, so it goes through the
// same SSRF + size guards as the page fetch. Responses are edge-cached by URL
// (LINK_PREVIEW_IMAGE_CACHE_CONTROL) so repeated cards don't hit the origin.

// SVG is deliberately not proxied: an SVG served top-level from our origin
// could run inline scripts (the global CSP keeps 'unsafe-inline' for hydration),
// turning the proxy into a stored-XSS vector.
const isSvgUrl = (url: string): boolean => {
  try {
    return /\.svg(?:$|\?)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

// Everything else defaults to image/jpeg — many og:image URLs have no image
// extension (query-string only).
function contentTypeFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    if (/\.png$/i.test(pathname)) return "image/png";
    if (/\.webp$/i.test(pathname)) return "image/webp";
    if (/\.gif$/i.test(pathname)) return "image/gif";
    if (/\.ico$/i.test(pathname)) return "image/x-icon";
  } catch {
    // fall through
  }
  return "image/jpeg";
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readLinkPreviewImage, ip, RATE_LIMITS.readLinkPreviewImage.limit, RATE_LIMITS.readLinkPreviewImage.windowMs)) {
    return NextResponse.json(
      { error: ERROR_TOO_MANY_REQUESTS },
      { status: HTTP_TOO_MANY_REQUESTS, headers: { "Cache-Control": LINK_PREVIEW_RATE_LIMITED_CACHE_CONTROL } },
    );
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();
  if (!url || !isSafeHttpUrl(url)) {
    return NextResponse.json({ error: ERROR_BAD_REQUEST }, { status: HTTP_BAD_REQUEST });
  }
  if (isSvgUrl(url)) {
    return NextResponse.json({ error: ERROR_BAD_REQUEST }, { status: HTTP_BAD_REQUEST });
  }

  try {
    const bytes = await fetchRemoteBytes(url, { maxBytes: MAX_LINK_PREVIEW_IMAGE_BYTES });
    if (!bytes) {
      // Upstream fetch failed — transient, not a property of the URL. Never
      // shared-cache it, or one upstream blip would pin the missing image for
      // every other visitor.
      return NextResponse.json(
        { error: ERROR_NOT_FOUND },
        { status: HTTP_NOT_FOUND, headers: { "Cache-Control": LINK_PREVIEW_TRANSIENT_CACHE_CONTROL } },
      );
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypeFromUrl(url),
        "Cache-Control": LINK_PREVIEW_IMAGE_CACHE_CONTROL,
      },
    });
  } catch (error) {
    return serverError("GET /api/link-preview/image", error);
  }
}
