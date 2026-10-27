import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";
import { isPubliclyVisible } from "@/lib/blog";
import { previewRichText } from "@/lib/rich-text";
import { publicVisibilityFilter } from "@/lib/services/feed-scope";
import type { ChannelDirectoryItem, ChannelDirectorySort } from "@/types/channel-directory";
import { CHANNEL_DIRECTORY_PAGE_SIZE } from "@/lib/channel-directory";

/** A stable, language-aware directory; summaries and activity only use publicly visible posts. */
export async function getChannelDirectory({ language, query, cursor, sort = "newest" }: {
  language: string; query?: string; cursor?: string | null; sort?: ChannelDirectorySort;
}): Promise<{ items: ChannelDirectoryItem[]; nextCursor: string | null }> {
  const normalizedQuery = query ? normalizeName(query) : "";
  const publicPosts = { ...publicVisibilityFilter(new Date()), language };
  let orderedIds: string[] | undefined;
  let moreActive = false;
  if (sort === "active") {
    // Composite keyset pagination avoids loading/sorting the entire directory in JS.
    // SQL values are bound parameters; future and private posts never affect ranking.
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH directory AS (
        SELECT c.id, COALESCE(activity.latest, c."createdAt") AS activity
        FROM "Channel" c
        JOIN "ChannelTranslation" t ON t."channelId" = c.id AND t.language = ${language}
        LEFT JOIN LATERAL (
          SELECT MAX(p."createdAt") AS latest FROM "Post" p
          WHERE p."channelId" = c.id AND p."isPublic" = true AND p.language = ${language}
            AND (p."publishedAt" IS NULL OR p."publishedAt" <= NOW())
        ) activity ON true
        WHERE POSITION(${normalizedQuery} IN LOWER(t."normalizedName")) > 0 OR ${normalizedQuery} = ''
      )
      SELECT id FROM directory
      WHERE ${cursor ?? null}::text IS NULL OR (activity, id) < (SELECT activity, id FROM directory WHERE id = ${cursor ?? null})
      ORDER BY activity DESC, id DESC LIMIT ${CHANNEL_DIRECTORY_PAGE_SIZE + 1}
    `);
    moreActive = rows.length > CHANNEL_DIRECTORY_PAGE_SIZE;
    orderedIds = rows.slice(0, CHANNEL_DIRECTORY_PAGE_SIZE).map((row) => row.id);
  }
  const channels = await prisma.channel.findMany({
    where: {
      ...(orderedIds ? { id: { in: orderedIds } } : {}),
      translations: { some: { language, ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery, mode: "insensitive" as const } } : {}) } },
    },
    select: {
      id: true, avatarUrl: true, createdAt: true, ownerId: true, isPersonal: true,
      _count: { select: { posts: { where: publicPosts } } },
      translations: { select: { language: true, name: true, slug: true }, take: 3 },
      posts: { where: publicPosts, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { content: true, createdAt: true, blogPost: { select: { title: true, isPublic: true, publishedAt: true } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CHANNEL_DIRECTORY_PAGE_SIZE + 1,
    ...(!orderedIds && cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  const ordered = orderedIds ? orderedIds.flatMap((id) => channels.filter((channel) => channel.id === id)) : channels;
  const hasMore = orderedIds ? moreActive : ordered.length > CHANNEL_DIRECTORY_PAGE_SIZE;
  const items = ordered.slice(0, CHANNEL_DIRECTORY_PAGE_SIZE).map(({ _count, translations, posts, ...channel }) => {
    const translation = translations.find((item) => item.language === language);
    const latest = posts?.[0];
    return {
      ...channel, name: translation?.name ?? "", slug: translation?.slug ?? "", postCount: _count.posts,
      languages: translations.map((item) => item.language),
      latestPostPreview: latest ? previewRichText(latest.content || (latest.blogPost && isPubliclyVisible(latest.blogPost) ? latest.blogPost.title : null)) : null,
      latestPostAt: latest?.createdAt.toISOString() ?? null,
    };
  });
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
}
