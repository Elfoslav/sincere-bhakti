import { isSafeHttpUrl } from "@/lib/validation";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

const META_CONTENT =
  /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi;

// Fall back to a stripped <title> when no og:title meta exists.
const TITLE_TAG = /<title[^>]*>([^<]*)<\/title>/i;

// Visible-content heading fallback (what WhatsApp/Facebook scrape when a page
// ships no OG tags): prefer the first non-empty <h1> then <h2>.
const HEADING_TAG = /<(h1|h2)\b[^>]*>([^<]*)<\/\1>/gi;

// Body <img> detection for pages without og:image. Trackers/analytics/badges
// are skipped so the preview doesn't show a pixel or "view counter" image.
const TRACKER_HOST_PATTERN =
  /(?:analytics|tracking|doubleclick|adservice|adsystem|google-analytics|googletagmanager|facebook\.tr|pixel|simpleanalytics|snap\.licdn|quantserve|scorecardresearch)/i;

const IMG_TAG = /<img\b[^>]*>/gi;

// <link rel="icon|shortcut icon|apple-touch-icon"> for the favicon fallback.
const ICON_TAG = /<link\b[^>]*rel=["'](?:shortcut icon|icon|apple-touch-icon)(?:["'])[^>]*>/gi;

function attrValue(html: string, name: string): string | null {
  // Lookbehind prevents matching data-src / data-href / data-width etc.
  const match = html.match(new RegExp(`(?<![\\w-])${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

// Extract the site favicon from <link rel="icon"> tags, resolved against the
// page URL. Returns null when none is declared.
function firstIcon(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(ICON_TAG)) {
    const href = cleanValue(attrValue(match[0], "href"));
    if (!href) continue;
    try {
      const resolved = new URL(href, pageUrl).href;
      if (!isSafeHttpUrl(resolved)) continue;
      return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

function firstHeading(html: string): string | null {
  for (const match of html.matchAll(HEADING_TAG)) {
    const text = cleanValue(match[2]);
    if (text) return text;
  }
  return null;
}

// Pick the "largest" body image as the thumbnail fallback. Without a DOM we
// rank by explicit width/height attributes; images without dimensions rank
// below sized ones and are only used if nothing else qualifies. Relative srcs
// are resolved against the page URL, and trackers are skipped.
function bestBodyImage(html: string, pageUrl: string): string | null {
  let best: { src: string; area: number } | null = null;
  for (const match of html.matchAll(IMG_TAG)) {
    const tag = match[0];
    const src = cleanValue(attrValue(tag, "src"));
    if (!src) continue;
    let resolved: string;
    try {
      resolved = new URL(src, pageUrl).href;
      if (!isSafeHttpUrl(resolved)) continue;
      if (TRACKER_HOST_PATTERN.test(new URL(resolved).hostname)) continue;
    } catch {
      continue;
    }
    const width = Number(attrValue(tag, "width"));
    const height = Number(attrValue(tag, "height"));
    const area = Number.isFinite(width) && Number.isFinite(height) ? width * height : 0;
    if (best && area <= best.area) continue;
    best = { src: resolved, area };
  }
  return best?.src ?? null;
}

const EMPTY_CONTENT = /^(?:\s*)$/;

// Named HTML entities decoded by cleanValue. Only the common text ones — the
// rest pass through unchanged.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  bull: "\u2022",
  middot: "\u00b7",
  laquo: "\u00ab",
  raquo: "\u00bb",
};

const ENTITY_REF = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;

function decodeEntities(value: string): string {
  return value.replace(ENTITY_REF, (match, entity: string) => {
    const lower = entity.toLowerCase();
    let code: number | null = null;
    if (lower.startsWith("#x")) {
      code = Number.parseInt(lower.slice(2), 16);
    } else if (lower.startsWith("#")) {
      code = Number.parseInt(lower.slice(1), 10);
    }
    if (code !== null && code > 0 && code <= 0x10ffff) {
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

function cleanValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const decoded = decodeEntities(value);
  const trimmed = decoded.trim();
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
  // No og:image: fall back to the largest in-body image (trackers excluded),
  // matching what WhatsApp/Facebook show for OG-less pages.
  if (!image) {
    image = bestBodyImage(html, pageUrl);
  }

  const title =
    cleanValue(meta["og:title"]) ??
    cleanValue(meta["twitter:title"]) ??
    firstHeading(html) ??
    cleanValue(html.match(TITLE_TAG)?.[1]) ??
    null;

  const description =
    cleanValue(meta["og:description"]) ??
    cleanValue(meta["twitter:description"]) ??
    cleanValue(meta["description"]) ??
    null;

  const siteName = cleanValue(meta["og:site_name"]) ?? null;

  const favicon = firstIcon(html, pageUrl);

  return {
    url: pageUrl,
    title,
    description,
    image,
    siteName,
    favicon,
  };
}
