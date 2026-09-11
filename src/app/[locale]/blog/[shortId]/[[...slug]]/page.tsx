import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCachedBlogPostByShortId, getBlogPosts, isBlogPubliclyVisible } from "@/lib/services/blog";
import { LATEST_BLOG_POSTS_LIMIT, selectLatestBlogPosts } from "@/lib/blog";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import BlogDetailClient from "../blog-detail-client";
import { getBlogUrl, getStaleBlogSlugRedirect } from "@/lib/blog-url";
import {
  POST_OG_IMAGE,
  createBreadcrumbJsonLd,
  createJsonLdScript,
  createPostJsonLd,
  getBlogOpenGraphImageUrl,
  getLocalizedUrl,
  truncateSeoText,
} from "@/lib/seo";
import { extractPlainText, previewRichText } from "@/lib/rich-text";
import { resolveArticleHtml } from "@/lib/rich-text-html";
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
  // Search/social descriptions truncate past ~160 chars — a hand-written
  // 300-char excerpt would otherwise be cut mid-sentence by the crawler.
  const description = post.excerpt
    ? truncateSeoText(post.excerpt, 160)
    : (previewRichText(post.content) || title);
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

  const title = post.title;
  const description = post.excerpt
    ? truncateSeoText(post.excerpt, 160)
    : (previewRichText(post.content) || title);
  const postUrl = getLocalizedUrl(post.language || locale, getBlogUrl(post.shortId, post.slug));
  // Stored HTML is already sanitized on write; legacy bodies render escaped.
  const contentHtml = resolveArticleHtml(post.contentHtml, post.content);
  const imageUrl = getBlogOpenGraphImageUrl(post.language || locale, post.shortId);
  const blogT = await getTranslations({ locale, namespace: "BlogPage" });
  const jsonLd = [
    createPostJsonLd({
      title,
      description,
      url: postUrl,
      imageUrl,
      channelName: post.channel.name,
      content: extractPlainText(post.content),
      createdAt: post.publishedAt ?? post.createdAt,
      language: post.language || locale,
    }),
    createBreadcrumbJsonLd([
      { name: blogT("title"), url: getLocalizedUrl(locale, "/blog") },
      { name: title, url: postUrl },
    ]),
  ];

  const serializable = JSON.parse(JSON.stringify(post)) as BlogPost;
  let latestPosts: BlogPost[] = [];
  try {
    const latest = await getBlogPosts({
      scope: "public",
      language: locale,
      requestLanguage: locale,
      limit: LATEST_BLOG_POSTS_LIMIT + 1,
    });
    latestPosts = JSON.parse(JSON.stringify(
      selectLatestBlogPosts(latest.posts, post.id, LATEST_BLOG_POSTS_LIMIT),
    )) as BlogPost[];
  } catch {
    latestPosts = [];
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <BlogDetailClient post={serializable} contentHtml={contentHtml} latestPosts={latestPosts} />
    </>
  );
}
