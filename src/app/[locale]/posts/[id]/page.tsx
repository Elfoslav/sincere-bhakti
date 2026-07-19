import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCachedPostById } from "@/lib/services/post";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import PostDetailClient from "./post-detail-client";
import {
  POST_OG_IMAGE,
  createBreadcrumbJsonLd,
  createJsonLdScript,
  createPostJsonLd,
  getLocalizedUrl,
  getOpenGraphLocale,
  getPostOpenGraphImageUrl,
  getPostSeoDescription,
  getPostSeoTitle,
} from "@/lib/seo";
import type { Post, MediaType } from "@/types/post";

type Params = { locale: string; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  const post = await getCachedPostById(id);
  if (!post || !post.isPublic) return {};

  const title = getPostSeoTitle(post.channel.name, post.content);
  const description = getPostSeoDescription(post.channel.name, post.content);
  const canonicalUrl = getLocalizedUrl(post.language || locale, `/posts/${id}`);
  const imageUrl = getPostOpenGraphImageUrl(post.language || locale, id);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "article",
      locale: getOpenGraphLocale(post.language || locale),
      url: canonicalUrl,
      siteName: "Sincere Bhakti",
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

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, id } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();

  const [post, session] = await Promise.all([getCachedPostById(id), auth()]);

  if (!post) notFound();
  if (!post.isPublic && (!session?.user?.id || !await canAuthorChannel(post.channel.id, session.user.id))) notFound();

  const serialized: Post = {
    ...post,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    media: post.media.map((m) => ({ ...m, type: m.type as MediaType })),
  };
  const title = getPostSeoTitle(post.channel.name, post.content);
  const description = getPostSeoDescription(post.channel.name, post.content);
  const postUrl = getLocalizedUrl(post.language || locale, `/posts/${id}`);
  const imageUrl = getPostOpenGraphImageUrl(post.language || locale, id);
  const jsonLd = [
    createPostJsonLd({
      title,
      description,
      url: postUrl,
      imageUrl,
      channelName: post.channel.name,
      content: post.content,
      createdAt: post.createdAt,
      language: post.language || locale,
    }),
    createBreadcrumbJsonLd([
      { name: "Posts", url: getLocalizedUrl(locale, "/posts") },
      { name: title, url: postUrl },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <PostDetailClient post={serialized} />
    </>
  );
}
