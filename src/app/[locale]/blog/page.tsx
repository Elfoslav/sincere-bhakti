import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/services/blog";
import { getCategoryByName } from "@/lib/services/category";
import { normalizeCategoryName } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { FEED_DEFAULT_LIMIT } from "@/lib/validation";
import type { BlogPost } from "@/types/blog";
import BlogPageClient from "./blog-page-client";
import { DEFAULT_OG_IMAGE, getLocalizedUrl } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channelId?: string; category?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "BlogPage" });

  // A ?category= view duplicates its pretty landing page: point crawlers at
  // the canonical path so link equity isn't split across URL variants.
  // Canonical only (no language alternates): same-slug categories of
  // different languages are distinct taxonomies.
  let alternates;
  const { category: rawCategory } = await searchParams;
  if (rawCategory?.trim()) {
    const category = await getCategoryByName(locale, rawCategory);
    if (category) alternates = { canonical: getLocalizedUrl(locale, `/blog/category/${category.slug}`) };
  }

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    ...(alternates ? { alternates } : {}),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { channelId, category: rawCategory } = await searchParams;
  // Canonicalize for display and filtering (service normalizes again).
  const category = rawCategory?.trim() ? normalizeCategoryName(rawCategory) : undefined;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  const allowed = await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs);

  let initialPublic: { posts: BlogPost[]; hasMore: boolean } | undefined;
  if (allowed && !channelId) {
    try {
      const result = await getBlogPosts({ scope: "public", language: locale, requestLanguage: locale, limit: FEED_DEFAULT_LIMIT, category });
      initialPublic = JSON.parse(JSON.stringify(result)) as { posts: BlogPost[]; hasMore: boolean };
    } catch {
      initialPublic = undefined;
    }
  }

  return <BlogPageClient initialPublic={initialPublic} channelId={channelId} category={category} />;
}
