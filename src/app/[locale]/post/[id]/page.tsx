import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostById } from "@/lib/services/post";
import { auth } from "@/lib/auth";
import { selectOgImageUrl } from "@/lib/og";
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

  const post = await getPostById(id);
  if (!post || !post.isPublic) return {};

  const ogTitle = post.content ? post.content.slice(0, 60) : undefined;
  const ogDescription = post.content ? post.content.slice(0, 160) : undefined;

  const postImage = selectOgImageUrl(post.media);
  const ogUrl = postImage ?? "/images/sincere-bhakti-logo.png";
  const selected = postImage
    ? post.media.find((m) => m.url === postImage)
    : undefined;

  const ogImages =
    selected?.width && selected?.height
      ? [{ url: ogUrl, width: selected.width, height: selected.height }]
      : postImage
        ? [{ url: ogUrl }]
        : [{ url: ogUrl, width: 603, height: 414 }];

  return {
    title: ogTitle || "Post",
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      locale: locale === "en" ? "en_US" : locale === "cs" ? "cs_CZ" : "sk_SK",
      url: `${siteUrl}/${locale}/post/${id}`,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogUrl],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const [post, session] = await Promise.all([getPostById(id), auth()]);

  if (!post) notFound();
  if (!post.isPublic && session?.user?.id !== post.author.id) notFound();

  const serialized: Post = {
    ...post,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    media: post.media.map((m) => ({ ...m, type: m.type as MediaType })),
  };

  return <PostDetailClient post={serialized} />;
}
