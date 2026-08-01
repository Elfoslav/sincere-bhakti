import { isSafeHttpUrl } from "@/lib/validation";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const META_CONTENT =
  /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi;

// Fall back to a stripped <title> when no og:title meta exists.
const TITLE_TAG = /<title[^>]*>([^<]*)<\/title>/i;

const EMPTY_CONTENT = /^(?:\s*)$/;

function cleanValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || EMPTY_CONTENT.test(trimmed)) return null;
  return trimmed;
}

/**
 * Extract Open Graph / Twitter meta fields from raw HTML. `pageUrl` resolves
 * relative image URLs (e.g. `/og.jpg` or `og.jpg`) against the page. Only
 * http(s) images survive — a `data:`/`javascript:` image URL is dropped.
 */
export function parseLinkPreview(html: string, pageUrl: string): LinkPreviewData {
  const meta: Record<string, string> = {};
  for (const match of html.matchAll(META_CONTENT)) {
    const key = match[1].toLowerCase();
    const value = match[2];
    if (key && !(key in meta)) {
      meta[key] = value;
    }
  }

  let image: string | null =
    meta["og:image:secure_url"] ?? meta["og:image:url"] ?? meta["og:image"] ?? meta["twitter:image"];
  image = cleanValue(image);
  if (image) {
    try {
      image = new URL(image, pageUrl).href;
      if (!isSafeHttpUrl(image)) image = null;
    } catch {
      image = null;
    }
  }

  const title =
    cleanValue(meta["og:title"]) ??
    cleanValue(meta["twitter:title"]) ??
    cleanValue(html.match(TITLE_TAG)?.[1]) ??
    null;

  const description =
    cleanValue(meta["og:description"]) ??
    cleanValue(meta["twitter:description"]) ??
    cleanValue(meta["description"]) ??
    null;

  const siteName = cleanValue(meta["og:site_name"]) ?? null;

  return {
    url: pageUrl,
    title,
    description,
    image,
    siteName,
  };
}
