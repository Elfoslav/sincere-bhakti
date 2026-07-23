import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/url";

export const SITE_NAME = "Sincere Bhakti";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

// Post previews embed user photos → JPEG. WhatsApp silently drops preview
// images over ~600 KB and a photo re-encoded as PNG easily exceeds 1.5 MB;
// a quality-80 JPEG of the same frame is ~100–250 KB.
export const POST_OG_IMAGE = {
  ...OG_IMAGE_SIZE,
  type: "image/jpeg",
};

// Satori/ImageResponse text cards (profile, channel) are flat art — those
// PNGs stay small (~40 KB), so PNG is fine there.
export const TEXT_OG_IMAGE = {
  ...OG_IMAGE_SIZE,
  type: "image/png",
};

// Flattened default preview (logo on ivory) for static pages. Never use a
// transparent PNG as og:image — WhatsApp/Telegram dark mode renders
// transparency as near-black, making dark logo ink invisible.
export const DEFAULT_OG_IMAGE = {
  ...OG_IMAGE_SIZE,
  type: "image/jpeg",
  url: "/images/og-default.jpg",
};

// CDN caching for OG image routes. They render dynamically (rate limiting
// reads headers()), so without these every crawler hit pays a DB lookup and
// a full image render.
//
// - Success: stable for an hour.
// - Missing/undecodable entity: this fallback IS the correct response for that
//   URL, so cache it briefly (short TTL lets it self-heal if the entity/image
//   later appears).
// - Rate-limited: transient PER-IP state, NOT a property of the URL. It must
//   never enter a shared cache — otherwise one throttled crawler pins the logo
//   fallback on a real card's URL for other visitors. Hence no-store.
export const OG_IMAGE_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
export const OG_IMAGE_FALLBACK_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
export const OG_IMAGE_RATE_LIMITED_CACHE_CONTROL = "private, no-store";

const OG_LOCALES: Record<string, string> = {
  en: "en_US",
  cs: "cs_CZ",
  sk: "sk_SK",
};

export function normalizeSeoText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function truncateSeoText(value: string | null | undefined, maxLength: number): string {
  const normalized = normalizeSeoText(value);
  if (normalized.length <= maxLength) return normalized;

  const sliced = normalized.slice(0, maxLength + 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const trimmed = (lastSpace > Math.floor(maxLength * 0.6) ? sliced.slice(0, lastSpace) : sliced.slice(0, maxLength)).trim();
  return `${trimmed}...`;
}

export function getOpenGraphLocale(locale: string): string {
  return OG_LOCALES[locale] ?? OG_LOCALES.en;
}

export function getLocalizedPath(locale: string, path: string): string {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${locale === "en" ? "" : `/${locale}`}${normalizedPath || "/"}`;
}

export function getLocalizedUrl(locale: string, path: string): string {
  return `${getSiteUrl()}${getLocalizedPath(locale, path)}`;
}

export function getLanguageAlternates(path: string): Record<string, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
  );
}

export function getCanonicalAlternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: getLocalizedUrl(locale, path),
    languages: getLanguageAlternates(path),
  };
}

export function getPostSeoTitle(channelName: string, content: string | null | undefined): string {
  const trimmedContent = truncateSeoText(content, 72);
  return trimmedContent ? `${channelName}: ${trimmedContent}` : channelName;
}

export function getPostSeoDescription(channelName: string, content: string | null | undefined): string {
  const trimmedContent = truncateSeoText(content, 155);
  return trimmedContent || `A devotional post from ${channelName}.`;
}

export function getPostOpenGraphImageUrl(locale: string, postId: string): string {
  return getLocalizedUrl(locale, `/posts/${postId}/opengraph-image`);
}

export function getChannelOpenGraphImageUrl(locale: string, slug: string): string {
  return getLocalizedUrl(locale, `/channels/${slug}/opengraph-image`);
}

export function createJsonLdScript(value: Record<string, unknown> | Array<Record<string, unknown>>) {
  return {
    __html: JSON.stringify(value).replace(/</g, "\\u003c"),
  };
}

export function createBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createPostJsonLd({
  title,
  description,
  url,
  imageUrl,
  channelName,
  content,
  createdAt,
  language,
}: {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  channelName: string;
  content: string | null | undefined;
  createdAt: Date | string;
  language: string;
}): Record<string, unknown> {
  const normalizedContent = normalizeSeoText(content);

  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: title,
    description,
    articleBody: normalizedContent || description,
    datePublished: new Date(createdAt).toISOString(),
    inLanguage: language,
    url,
    image: [imageUrl],
    author: {
      "@type": "Organization",
      name: channelName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  };
}

export function createChannelJsonLd({
  name,
  description,
  url,
  imageUrl,
}: {
  name: string;
  description: string;
  url: string;
  imageUrl: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name,
    description,
    url,
    image: imageUrl,
    mainEntity: {
      "@type": "Organization",
      name,
      url,
      image: imageUrl,
    },
  };
}

export function getNoIndexMetadata(title?: string): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
