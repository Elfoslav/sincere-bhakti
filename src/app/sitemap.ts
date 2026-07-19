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

  const [channels, posts, users] = await Promise.all([
    prisma.channel.findMany({
      where: { posts: { some: { isPublic: true } } },
      select: { slug: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    prisma.post.findMany({
      where: { isPublic: true },
      select: { id: true, language: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    prisma.user.findMany({
      where: { channels: { some: { posts: { some: { isPublic: true } } } } },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
  ]);

  for (const channel of channels) {
    const path = `/channels/${channel.slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: getLocalizedUrl(locale, path),
        lastModified: channel.createdAt,
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

  for (const user of users) {
    const path = `/profile/${user.id}`;
    for (const locale of routing.locales) {
      entries.push({
        url: getLocalizedUrl(locale, path),
        lastModified: user.createdAt,
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
