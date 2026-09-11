import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getLanguageAlternates, getLocalizedUrl } from "@/lib/seo";
import { getPostUrl } from "@/lib/post-url";
import { getBlogUrl } from "@/lib/blog-url";

export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "", changeFrequency: "daily", priority: 1.0 },
    { path: "/posts", changeFrequency: "daily", priority: 0.8 },
    { path: "/blog", changeFrequency: "daily", priority: 0.8 },
    { path: "/channels", changeFrequency: "daily", priority: 0.7 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const { path, changeFrequency, priority } of staticPages) {
      entries.push({
        url: getLocalizedUrl(locale, path || "/"),
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: {
          languages: getLanguageAlternates(path || "/"),
        },
      });
    }
  }

  const [channels, posts, blogPosts] = await Promise.all([
    prisma.channel.findMany({
      where: { posts: { some: { isPublic: true } } },
      select: {
        id: true,
        createdAt: true,
        posts: {
          where: { isPublic: true },
          select: { createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
        translations: { select: { language: true, slug: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    prisma.post.findMany({
      where: { isPublic: true },
      select: { id: true, shortId: true, slug: true, language: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    // Only publicly visible articles: flagged public with a past publish date.
    // Scheduled (future) and private posts stay out of the sitemap.
    prisma.blogPost.findMany({
      where: { isPublic: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      select: { id: true, shortId: true, slug: true, language: true, publishedAt: true, createdAt: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
  ]);

  for (const channel of channels) {
    const latestPublicPostAt = channel.posts[0]?.createdAt ?? channel.createdAt;

    for (const translation of channel.translations) {
      const path = `/channels/${translation.slug}`;
      entries.push({
        url: getLocalizedUrl(translation.language, path),
        lastModified: latestPublicPostAt,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      });
    }
  }

  for (const post of posts) {
    entries.push({
      url: getLocalizedUrl(post.language, getPostUrl(post.shortId, post.slug)),
      lastModified: post.createdAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const post of blogPosts) {
    entries.push({
      url: getLocalizedUrl(post.language, getBlogUrl(post.shortId, post.slug)),
      lastModified: post.publishedAt ?? post.createdAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
