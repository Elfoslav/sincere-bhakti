import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/validation";
import { fetchRemoteBytes, MAX_LINK_PREVIEW_HTML_BYTES } from "@/lib/remote-fetch";
import { parseLinkPreview, type LinkPreviewData } from "@/lib/link-preview";
import { ERROR_BAD_REQUEST, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";
import {
  LINK_PREVIEW_CACHE_CONTROL,
  LINK_PREVIEW_FALLBACK_CACHE_CONTROL,
  LINK_PREVIEW_RATE_LIMITED_CACHE_CONTROL,
  LINK_PREVIEW_TRANSIENT_CACHE_CONTROL,
} from "@/lib/seo";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readLinkPreview, ip, RATE_LIMITS.readLinkPreview.limit, RATE_LIMITS.readLinkPreview.windowMs)) {
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

  try {
    const html = await fetchRemoteBytes(url, { maxBytes: MAX_LINK_PREVIEW_HTML_BYTES });
    if (!html) {
      // Upstream fetch failed — a transient condition, not a property of the
      // URL. Never shared-cache it, or one upstream blip would pin an empty
      // card for every other visitor.
      return NextResponse.json(
        { preview: null },
        { headers: { "Cache-Control": LINK_PREVIEW_TRANSIENT_CACHE_CONTROL } },
      );
    }

    const data: LinkPreviewData = parseLinkPreview(
      html.toString("utf8").slice(0, MAX_LINK_PREVIEW_HTML_BYTES),
      url,
    );

    // Nothing usable extracted — respond with a null preview so the client
    // simply hides the card instead of showing a broken one. This is the
    // correct response for the URL, so cache it briefly (short TTL lets it
    // self-heal if the page later adds og tags).
    const hasContent = data.title || data.description || data.image;
    return NextResponse.json(
      { preview: hasContent ? data : null },
      {
        headers: {
          "Cache-Control": hasContent ? LINK_PREVIEW_CACHE_CONTROL : LINK_PREVIEW_FALLBACK_CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    return serverError("GET /api/link-preview", error);
  }
}
