import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getLanguageAlternates, getLocalizedUrl } from "@/lib/seo";

export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "", changeFrequency: "daily", priority: 1.0 },
    { path: "/posts", changeFrequency: "daily", priority: 0.8 },
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

  const [channels, posts] = await Promise.all([
    prisma.channel.findMany({
      where: { posts: { some: { isPublic: true } } },
      select: {
        id: true,
        createdAt: true,
        owner: { select: { id: true, createdAt: true } },
        posts: {
          where: { isPublic: true },
          select: { createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
        translations: { select: { slug: true }, take: 1 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    prisma.post.findMany({
      where: { isPublic: true },
      select: { id: true, language: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
  ]);

  const latestPublicPostByOwner = new Map<string, { createdAt: Date; ownerCreatedAt: Date }>();

  for (const channel of channels) {
    const channelSlug = channel.translations[0]?.slug;
    if (!channelSlug) continue;
    const path = `/channels/${channelSlug}`;
    const latestPublicPostAt = channel.posts[0]?.createdAt ?? channel.createdAt;
    const ownerActivity = latestPublicPostByOwner.get(channel.owner.id);
    if (!ownerActivity || ownerActivity.createdAt < latestPublicPostAt) {
      latestPublicPostByOwner.set(channel.owner.id, {
        createdAt: latestPublicPostAt,
        ownerCreatedAt: channel.owner.createdAt,
      });
    }

    for (const locale of routing.locales) {
      entries.push({
        url: getLocalizedUrl(locale, path),
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
      url: getLocalizedUrl(post.language, `/posts/${post.id}`),
      lastModified: post.createdAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const [userId, activity] of latestPublicPostByOwner) {
    const path = `/profile/${userId}`;
    for (const locale of routing.locales) {
      entries.push({
        url: getLocalizedUrl(locale, path),
        lastModified: activity.createdAt ?? activity.ownerCreatedAt,
        changeFrequency: "weekly",
        priority: 0.4,
        alternates: {
          languages: getLanguageAlternates(path),
        },
      });
    }
  }

  return entries;
}
