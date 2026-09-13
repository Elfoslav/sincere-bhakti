import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/services/blog";
import { getCategoryBySlug } from "@/lib/services/category";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { FEED_DEFAULT_LIMIT } from "@/lib/validation";
import type { BlogPost } from "@/types/blog";
import BlogPageClient from "../../blog-page-client";
import { DEFAULT_OG_IMAGE, getLocalizedUrl } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "BlogPage" });
  const category = await getCategoryBySlug(locale, slug);
  if (!category) return {};

  const title = t("categoryMetaTitle", { name: category.name });
  const description = t("categoryMetaDescription", { name: category.name });
  // No language alternates: same-slug categories of different languages
  // are distinct taxonomies, not translations of each other.
  return {
    title,
    description,
    alternates: { canonical: getLocalizedUrl(locale, `/blog/category/${category.slug}`) },
    openGraph: {
      title,
      description,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs)) notFound();

  const category = await getCategoryBySlug(locale, slug);
  if (!category) notFound();

  let initialPublic: { posts: BlogPost[]; hasMore: boolean } | undefined;
  try {
    const result = await getBlogPosts({
      scope: "public",
      language: locale,
      requestLanguage: locale,
      limit: FEED_DEFAULT_LIMIT,
      category: category.name,
    });
    initialPublic = JSON.parse(JSON.stringify(result)) as { posts: BlogPost[]; hasMore: boolean };
  } catch {
    initialPublic = undefined;
  }

  return <BlogPageClient initialPublic={initialPublic} category={category.name} />;
}
