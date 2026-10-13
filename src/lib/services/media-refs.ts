import { prisma } from "@/lib/prisma";
import { canonicalizeUrl } from "@/lib/url";

/**
 * R2 media URLs live in one shared namespace: a trusted URL from `posts/`,
 * `blog/`, or `gallery/` can be linked from a timeline post, an album item,
 * or an album/blog cover. A file may only be deleted from storage when NO table
 * references it anymore — otherwise deleting an album would break a post
 * reusing the same photo (uploads normally mint fresh keys, but edits and
 * API clients can relink an existing URL). One batched query per table.
 *
 * Idempotent on already-canonical URLs — callers may pass raw or canonical.
 */
export async function filterOrphanedMediaUrls(urls: string[]): Promise<string[]> {
  const canonical = urls.map(canonicalizeUrl);
  if (canonical.length === 0) return [];
  const [inPosts, inAlbums, inBlogs, inAlbumCovers] = await Promise.all([
    prisma.media.findMany({
      where: { url: { in: canonical } },
      select: { url: true },
      distinct: ["url"],
    }),
    prisma.albumItem.findMany({
      where: { url: { in: canonical } },
      select: { url: true },
      distinct: ["url"],
    }),
    prisma.blogPost.findMany({
      where: { coverUrl: { in: canonical } },
      select: { coverUrl: true },
    }),
    prisma.album.findMany({
      where: { coverUrl: { in: canonical } },
      select: { coverUrl: true },
      distinct: ["coverUrl"],
      take: canonical.length,
    }),
  ]);
  const referenced = new Set([
    ...inPosts.map((m) => canonicalizeUrl(m.url)),
    ...inAlbums.map((m) => canonicalizeUrl(m.url)),
    ...inBlogs.map((b) => b.coverUrl).filter((u): u is string => u !== null).map(canonicalizeUrl),
    ...inAlbumCovers.map((a) => a.coverUrl).filter((u): u is string => u !== null).map(canonicalizeUrl),
  ]);
  return canonical.filter((url) => !referenced.has(url));
}
