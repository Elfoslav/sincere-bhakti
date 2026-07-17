import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCachedPostById } from "@/lib/services/post";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import PostDetailClient from "./post-detail-client";
import { getSiteUrl } from "@/lib/url";
import type { Post, MediaType } from "@/types/post";

const siteUrl = getSiteUrl();

type Params = { locale: string; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  const post = await getCachedPostById(id);
  if (!post || !post.isPublic) return {};

  const ogTitle = post.content ? post.content.slice(0, 60) : undefined;
  const ogDescription = post.content ? post.content.slice(0, 160) : undefined;

  return {
    title: ogTitle || "Post",
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      locale: locale === "en" ? "en_US" : locale === "cs" ? "cs_CZ" : "sk_SK",
      url: `${siteUrl}/${locale}/posts/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

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

  return <PostDetailClient post={serialized} />;
}
