import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCachedBlogPostByShortId, isBlogPubliclyVisible } from "@/lib/services/blog";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import BlogDetailClient from "../blog-detail-client";
import { getBlogUrl, getStaleBlogSlugRedirect } from "@/lib/blog-url";
import { POST_OG_IMAGE, getBlogOpenGraphImageUrl } from "@/lib/seo";
import type { BlogPost } from "@/types/blog";

type Params = { locale: string; shortId: string; slug?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, shortId } = await params;

  const post = await getCachedBlogPostByShortId(shortId, locale);
  if (!post || !isBlogPubliclyVisible(post)) return {};

  const title = post.title;
  const description = post.excerpt ?? post.content?.slice(0, 160) ?? title;
  const imageUrl = getBlogOpenGraphImageUrl(post.language || locale, post.shortId);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ ...POST_OG_IMAGE, url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, shortId, slug } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogDetail, ip, RATE_LIMITS.readBlogDetail.limit, RATE_LIMITS.readBlogDetail.windowMs)) notFound();

  const post = await getCachedBlogPostByShortId(shortId, locale);
  if (!post) notFound();

  if (!isBlogPubliclyVisible(post)) {
    const session = await auth();
    if (!session?.user?.id || !await canAuthorChannel(post.channel.id, session.user.id)) {
      notFound();
    }
  }

  const providedSlug = slug?.[0];
  const redirectTo = getStaleBlogSlugRedirect(providedSlug, shortId, post.slug);
  if (redirectTo) redirect(getBlogUrl(shortId, post.slug));

  const serializable = JSON.parse(JSON.stringify(post)) as BlogPost;
  return <BlogDetailClient post={serializable} />;
}
