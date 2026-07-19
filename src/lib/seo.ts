import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/url";
import { isSafeHttpUrl } from "@/lib/validation";

export const SITE_NAME = "Sincere Bhakti";
export const DEFAULT_OG_IMAGE = {
  url: "/images/sincere-bhakti-logo.png",
  width: 603,
  height: 414,
};
export const POST_OG_IMAGE = {
  width: 1200,
  height: 630,
  type: "image/png",
};

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

export function getSeoImageUrl(...candidates: Array<string | null | undefined>): string {
  return candidates.find((candidate) => candidate && isSafeHttpUrl(candidate)) ?? DEFAULT_OG_IMAGE.url;
}

export function getJsonLdImageUrl(...candidates: Array<string | null | undefined>): string {
  return candidates.find((candidate) => candidate && isSafeHttpUrl(candidate)) ?? `${getSiteUrl()}${DEFAULT_OG_IMAGE.url}`;
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

export function createProfileJsonLd({
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
      "@type": "Person",
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
