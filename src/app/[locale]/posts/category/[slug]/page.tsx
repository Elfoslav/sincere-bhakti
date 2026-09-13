import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPosts } from "@/lib/services/post";
import { getCategoryBySlug } from "@/lib/services/category";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { FEED_DEFAULT_LIMIT } from "@/lib/validation";
import type { Post } from "@/types/post";
import PostsPageClient from "../../posts-page-client";
import { DEFAULT_OG_IMAGE, getLocalizedUrl } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "PostsPage" });
  const category = await getCategoryBySlug(locale, slug);
  if (!category) return {};

  const title = t("categoryMetaTitle", { name: category.name });
  const description = t("categoryMetaDescription", { name: category.name });
  // No language alternates: same-slug categories of different languages
  // are distinct taxonomies, not translations of each other.
  return {
    title,
    description,
    alternates: { canonical: getLocalizedUrl(locale, `/posts/category/${category.slug}`) },
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

export default async function PostsCategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();

  const category = await getCategoryBySlug(locale, slug);
  if (!category) notFound();

  let initialPublic: { posts: Post[]; hasMore: boolean } | undefined;
  try {
    const result = await getPosts({
      scope: "public",
      language: locale,
      requestLanguage: locale,
      limit: FEED_DEFAULT_LIMIT,
      category: category.name,
    });
    initialPublic = JSON.parse(JSON.stringify(result)) as { posts: Post[]; hasMore: boolean };
  } catch {
    initialPublic = undefined;
  }

  return <PostsPageClient initialPublic={initialPublic} category={category.name} />;
}
