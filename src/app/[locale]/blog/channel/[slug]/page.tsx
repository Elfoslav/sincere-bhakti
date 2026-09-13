import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/services/blog";
import { getCachedChannelBySlug, resolveSlugRedirect } from "@/lib/services/channel";
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
  const channel = await getCachedChannelBySlug(slug, locale);
  if (!channel) return {};

  const title = t("channelMetaTitle", { name: channel.name });
  const description = t("channelMetaDescription", { name: channel.name });
  // Channel slugs are per-language translations of the same channel, so the
  // resolved slug is the canonical one for the requested locale.
  return {
    title,
    description,
    alternates: { canonical: getLocalizedUrl(locale, `/blog/channel/${channel.slug}`) },
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

export default async function BlogChannelPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs)) notFound();

  const channel = await getCachedChannelBySlug(slug, locale);
  if (!channel) {
    const targetSlug = await resolveSlugRedirect(slug, locale);
    if (targetSlug) {
      redirect(`/${locale}/blog/channel/${targetSlug}`);
    }
    notFound();
  }

  // The slug in the URL may belong to a different locale's translation.
  // Redirect to the correct slug for the requested locale so the address bar
  // matches the resolved translation.
  if (channel.slug !== slug) {
    redirect(`/${locale}/blog/channel/${channel.slug}`);
  }

  let initialPublic: { posts: BlogPost[]; hasMore: boolean } | undefined;
  try {
    const result = await getBlogPosts({
      scope: "public",
      language: locale,
      requestLanguage: locale,
      limit: FEED_DEFAULT_LIMIT,
      channelId: channel.id,
    });
    initialPublic = JSON.parse(JSON.stringify(result)) as { posts: BlogPost[]; hasMore: boolean };
  } catch {
    initialPublic = undefined;
  }

  return <BlogPageClient initialPublic={initialPublic} channelId={channel.id} channelName={channel.name} />;
}
