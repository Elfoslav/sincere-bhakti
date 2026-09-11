import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/services/blog";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import type { BlogPost } from "@/types/blog";
import BlogPageClient from "./blog-page-client";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channelId?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "BlogPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
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
  const { channelId } = await searchParams;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  const allowed = await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs);

  let initialPublic: { posts: BlogPost[]; hasMore: boolean } | undefined;
  if (allowed && !channelId) {
    try {
      const result = await getBlogPosts({ scope: "public", language: locale, requestLanguage: locale, limit: 10 });
      initialPublic = JSON.parse(JSON.stringify(result)) as { posts: BlogPost[]; hasMore: boolean };
    } catch {
      initialPublic = undefined;
    }
  }

  return <BlogPageClient initialPublic={initialPublic} channelId={channelId} />;
}
