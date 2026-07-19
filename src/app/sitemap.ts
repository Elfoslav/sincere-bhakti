import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getLanguageAlternates, getLocalizedUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["", "/posts"];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of staticPages) {
      entries.push({
        url: getLocalizedUrl(locale, page || "/"),
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: page === "" ? 1.0 : 0.8,
        alternates: {
          languages: getLanguageAlternates(page || "/"),
        },
      });
    }
  }

  const [channels, posts] = await Promise.all([
    prisma.channel.findMany({
      where: { posts: { some: { isPublic: true } } },
      select: {
        slug: true,
        createdAt: true,
        owner: { select: { id: true, createdAt: true } },
        posts: {
          where: { isPublic: true },
          select: { createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
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
    const path = `/channels/${channel.slug}`;
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
