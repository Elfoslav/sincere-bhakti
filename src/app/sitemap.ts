import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getLanguageAlternates, getLocalizedUrl } from "@/lib/seo";
import { getPostUrl } from "@/lib/post-url";
import { getBlogUrl } from "@/lib/blog-url";
import { publicVisibilityFilter } from "@/lib/services/feed-scope";

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

  // One clock for every clause below so parallel queries can't disagree on
  // "now", and one shared visibility predicate (feed-scope) instead of five
  // inline copies.
  const now = new Date();
  const visible = publicVisibilityFilter(now);

  const [channels, posts, blogPosts, categories] = await Promise.all([
    prisma.channel.findMany({
      where: {
        OR: [
          { posts: { some: { ...visible } } },
          { blogPosts: { some: { ...visible } } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        posts: {
          where: { ...visible },
          select: { createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
        blogPosts: {
          where: { ...visible },
          select: { createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
        translations: { select: { language: true, slug: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    // Only publicly visible posts: flagged public with no (or a past) publish
    // date. Scheduled promos stay out until their article goes live.
    prisma.post.findMany({
      where: { ...visible },
      select: { id: true, shortId: true, slug: true, language: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    // Only publicly visible articles: flagged public with a past publish date.
    // Scheduled (future) and private posts stay out of the sitemap.
    prisma.blogPost.findMany({
      where: { ...visible },
      select: { id: true, shortId: true, slug: true, language: true, publishedAt: true, createdAt: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
    // Category landing pages that actually file something (an orphaned
    // category left behind by deletions stays out until reused).
    prisma.category.findMany({
      where: { OR: [{ posts: { some: {} } }, { blogPosts: { some: {} } }] },
      select: { slug: true, language: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
  ]);

  for (const channel of channels) {
    const latestPublicPostAt = channel.posts[0]?.createdAt ?? channel.createdAt;
    const latestPublicBlogPostAt = channel.blogPosts[0]?.createdAt;

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
      // Blog-filtered channel view — only when the channel actually has
      // public articles, so the sitemap never points at an empty filter.
      if (latestPublicBlogPostAt) {
        const blogPath = `/blog/channel/${translation.slug}`;
        entries.push({
          url: getLocalizedUrl(translation.language, blogPath),
          lastModified: latestPublicBlogPostAt,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
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

  for (const category of categories) {
    // No language alternates: same-slug categories of different languages
    // are distinct taxonomies, not translations of each other.
    for (const base of ["/posts/category", "/blog/category"] as const) {
      entries.push({
        url: getLocalizedUrl(category.language, `${base}/${category.slug}`),
        lastModified: category.createdAt,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
