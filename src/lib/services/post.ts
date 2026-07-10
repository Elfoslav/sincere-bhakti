import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { canonicalizeUrl } from "@/lib/url";
import type { Prisma } from "@prisma/client";
import type { PostChannel } from "@/types/post";

async function deletePendingUploads(urls: string[]): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  if (!storageDomain) return;
  const keys = urls
    .map((u) => extractKey(u, storageDomain))
    .filter((k): k is string => k !== null);
  if (keys.length > 0) {
    await prisma.pendingUpload.deleteMany({ where: { key: { in: keys } } });
  }
}

export class UnauthorizedError extends Error {
  name = "UnauthorizedError" as const;
}
export class NotFoundError extends Error {
  name = "NotFoundError" as const;
}
export class ForbiddenError extends Error {
  name = "ForbiddenError" as const;
}
export class ValidationError extends Error {
  name = "ValidationError" as const;
}

export interface PostMedia {
  url: string;
  type: string;
  position: number;
  width: number | null;
  height: number | null;
}

export interface PostResponse {
  id: string;
  content: string | null;
  isPublic: boolean;
  createdAt: Date;
  channel: PostChannel;
  media: PostMedia[];
}

export interface GetPostsParams {
  scope?: "public" | "private";
  cursor?: string;
  limit?: number;
  channelId?: string;
  language?: string;
}

export interface GetPostsResult {
  posts: PostResponse[];
  hasMore: boolean;
}

export interface MediaInput {
  url: string;
  type: string;
  width?: number;
  height?: number;
}

export interface CreatePostData {
  id?: string;
  content?: string;
  media?: MediaInput[];
  isPublic?: boolean;
  language?: string;
  channelId?: string;
}

export interface UpdatePostData {
  content?: string | null;
  isPublic?: boolean;
  media?: MediaInput[];
}

const postInclude = {
  channel: { select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true } },
  media: { orderBy: { position: "asc" as const } },
};

export async function getPosts(
  params: GetPostsParams,
  currentUserId?: string,
): Promise<GetPostsResult> {
  const { scope, cursor, limit = 10, channelId, language } = params;

  const where: Prisma.PostWhereInput = {};
  if (language) where.language = language;

  if (scope === "public") {
    where.isPublic = true;
    if (channelId) where.channelId = channelId;
  } else if (scope === "private") {
    if (!currentUserId) throw new UnauthorizedError();
    if (channelId) {
      // Only channel owner may view private posts
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel || channel.ownerId !== currentUserId) {
        throw new UnauthorizedError();
      }
      where.channelId = channelId;
    } else {
      // No channelId: scope to user's own channels
      const userChannels = await prisma.channel.findMany({
        where: { ownerId: currentUserId },
        select: { id: true },
      });
      if (userChannels.length > 0) {
        where.channelId = { in: userChannels.map((c) => c.id) };
      } else {
        where.id = "none";
      }
    }
    where.isPublic = false;
  } else {
    if (!currentUserId) throw new UnauthorizedError();
    if (channelId) {
      // Non-owners may only see public posts of the channel
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel) throw new NotFoundError();
      where.channelId = channelId;
      if (channel.ownerId !== currentUserId) {
        where.isPublic = true;
      }
    } else {
      // No channelId: scope to user's own channels
      const userChannels = await prisma.channel.findMany({
        where: { ownerId: currentUserId },
        select: { id: true },
      });
      if (userChannels.length > 0) {
        where.channelId = { in: userChannels.map((c) => c.id) };
      } else {
        where.id = "none";
      }
    }
  }

  const posts = await prisma.post.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: { createdAt: "desc" },
    include: postInclude,
  });

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  return { posts, hasMore };
}

export async function getPostById(id: string): Promise<PostResponse | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });

  return post;
}

async function validateMediaOwnership(
  media: MediaInput[],
  userId: string,
): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  if (!storageDomain) return;

  // Filter to storage-origin URLs using origin comparison (not startsWith)
  const storageUrls: { item: MediaInput; key: string }[] = [];
  for (const item of media) {
    const key = extractKey(item.url, storageDomain);
    if (key) storageUrls.push({ item, key });
  }
  if (storageUrls.length === 0) return;

  // Check existing media in DB — if a record exists with a different userId, reject
  const existing = await prisma.media.findMany({
    where: { url: { in: storageUrls.map((s) => canonicalizeUrl(s.item.url)) } },
    select: { url: true, userId: true },
  });

  for (const { item } of storageUrls) {
    const url = canonicalizeUrl(item.url);
    const record = existing.find((r) => canonicalizeUrl(r.url) === url);
    if (record && record.userId !== userId) {
      throw new ForbiddenError("media_not_owned");
    }
  }

  // Check PendingUpload records for URLs not yet linked to a post
  const keys = storageUrls.map((s) => s.key);
  const pending = await prisma.pendingUpload.findMany({
    where: { key: { in: keys } },
    select: { key: true, userId: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.key, p.userId]));
  for (const { key } of storageUrls) {
    const ownerId = pendingMap.get(key);
    if (ownerId && ownerId !== userId) {
      throw new ForbiddenError("media_not_owned");
    }
  }
}

export async function createPost(
  data: CreatePostData,
  userId: string,
): Promise<PostResponse> {
  const { id, content, media = [], isPublic = true, language = "en", channelId } = data;
  await validateMediaOwnership(media, userId);

  if (!channelId) throw new ValidationError("channel_required");

  const post = await prisma.post.create({
    data: {
      ...(id ? { id } : {}),
      content: content || null,
      isPublic,
      language,
      channelId,
      media: {
        create: media.map((m, i) => ({
          url: m.url,
          type: m.type,
          position: i,
          width: m.width ?? null,
          height: m.height ?? null,
          userId,
        })),
      },
    },
    include: postInclude,
  });

  // Remove PendingUpload records for the newly created media
  await deletePendingUploads(media.map((m) => m.url));

  return post;
}

export async function deletePost(
  id: string,
  userId: string,
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { url: true } }, channel: { select: { ownerId: true } } },
  });
  if (!post) throw new NotFoundError();
  if (post.channel.ownerId !== userId) throw new ForbiddenError();

  const urls = post.media.map((m) => canonicalizeUrl(m.url));

  await prisma.post.deleteMany({ where: { id, channel: { ownerId: userId } } });

  const counts = await Promise.all(
    urls.map((url) => prisma.media.count({ where: { url } })),
  );
  const orphaned = urls.filter((_, i) => counts[i] === 0);
  await deleteMediaFiles(orphaned);
}

export async function updatePost(
  id: string,
  userId: string,
  data: UpdatePostData,
): Promise<PostResponse> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { url: true } }, channel: { select: { ownerId: true } } },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId) throw new NotFoundError();

  const { media, ...postData } = data;
  if (media !== undefined) await validateMediaOwnership(media, userId);

  const post = await prisma.$transaction(async (tx) => {
    if (media !== undefined) {
      await tx.media.deleteMany({ where: { postId: id } });
      if (media.length > 0) {
        await tx.media.createMany({
          data: media.map((m, i) => ({
            url: m.url,
            type: m.type,
            position: i,
            width: m.width ?? null,
            height: m.height ?? null,
            postId: id,
            userId,
          })),
        });
      }
    }

    const { count } = await tx.post.updateMany({
      where: { id },
      data: postData,
    });

    if (count === 0) {
      throw new NotFoundError();
    }

    const updated = await tx.post.findUnique({
      where: { id },
      include: postInclude,
    })!;

    if (updated && !updated.content && updated.media.length === 0) {
      throw new ValidationError("post_must_have_content_or_media");
    }

    return updated;
  });

  if (media !== undefined) {
    // Remove PendingUpload records for newly linked media URLs
    await deletePendingUploads(media.map((m) => m.url));

    const removed = existing.media
      .filter(
        (old) => !media.some((m) => canonicalizeUrl(m.url) === canonicalizeUrl(old.url)),
      )
      .map((m) => canonicalizeUrl(m.url));
    const counts = await Promise.all(
      removed.map((url) => prisma.media.count({ where: { url } })),
    );
    const orphaned = removed.filter((_, i) => counts[i] === 0);
    await deleteMediaFiles(orphaned);
  }

  return post!;
}
