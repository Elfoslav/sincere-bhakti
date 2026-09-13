import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPosts } from "@/lib/services/post";
import { getCategoryByName } from "@/lib/services/category";
import { normalizeCategoryName } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { FEED_DEFAULT_LIMIT } from "@/lib/validation";
import type { Post } from "@/types/post";
import PostsPageClient from "./posts-page-client";
import { DEFAULT_OG_IMAGE, getLocalizedUrl } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
};

// Render per-request: the first feed page is fetched live from the DB, so this
// must not be statically prerendered at build time. Using headers() in the page
// component already opts into dynamic rendering automatically.

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PostsPage" });

  // A ?category= view duplicates its pretty landing page: point crawlers at
  // the canonical path so link equity isn't split across URL variants.
  // Canonical only (no language alternates): same-slug categories of
  // different languages are distinct taxonomies.
  let alternates;
  const { category: rawCategory } = await searchParams;
  if (rawCategory?.trim()) {
    const category = await getCategoryByName(locale, rawCategory);
    if (category) alternates = { canonical: getLocalizedUrl(locale, `/posts/category/${category.slug}`) };
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

export default async function PostsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { category: rawCategory } = await searchParams;
  // Canonicalize for display and filtering (service normalizes again).
  const category = rawCategory?.trim() ? normalizeCategoryName(rawCategory) : undefined;
  setRequestLocale(locale);

  // Rate-limit the SSR feed fetch so abusive/bot traffic hitting
  // /posts doesn't hammer Prisma directly (the client-side fallback
  // goes through the API route which has its own rate limit).
  const ip = getClientIp(await headers());
  const allowed = await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs);

  // Fetch the first page of the public feed on the server so it's in the HTML —
  // no hydrate→fetch→render waterfall. JSON round-trip mirrors the API response
  // shape (Date → ISO string) that the client hook expects.
  let initialPublic: { posts: Post[]; hasMore: boolean } | undefined;
  if (allowed) {
    try {
      const result = await getPosts({ scope: "public", language: locale, requestLanguage: locale, limit: FEED_DEFAULT_LIMIT, category });
      initialPublic = JSON.parse(JSON.stringify(result)) as { posts: Post[]; hasMore: boolean };
    } catch {
      initialPublic = undefined;
    }
  }

  return <PostsPageClient initialPublic={initialPublic} category={category} />;
}
