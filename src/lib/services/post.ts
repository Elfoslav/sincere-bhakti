import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { canonicalizeUrl } from "@/lib/url";
import { isChannelEditor } from "@/lib/services/channel";
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
export class ConflictError extends Error {
  name = "ConflictError" as const;
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
  language: string;
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
  language?: string;
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
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel || (channel.ownerId !== currentUserId && !await isChannelEditor(channelId, currentUserId))) {
        throw new UnauthorizedError();
      }
      where.channelId = channelId;
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId } } } },
      ];
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
      if (channel.ownerId !== currentUserId && !await isChannelEditor(channelId, currentUserId)) {
        where.isPublic = true;
      }
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId } } } },
      ];
    }
  }

  const posts = await prisma.post.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

// `generateMetadata` and the page body both need the same post data. React's
// cache memoizes the lookup within a request so we don't double-hit Prisma.
export const getCachedPostById = cache(getPostById);

async function validateMediaOwnership(
  media: MediaInput[],
  userId: string,
  allowedUrls: string[] = [],
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
  const allowed = new Set(allowedUrls.map(canonicalizeUrl));
  const existing = await prisma.media.findMany({
    where: { url: { in: storageUrls.map((s) => canonicalizeUrl(s.item.url)) } },
    select: { url: true, userId: true },
  });

  for (const { item } of storageUrls) {
    const url = canonicalizeUrl(item.url);
    if (allowed.has(url)) continue;
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
  for (const { item, key } of storageUrls) {
    if (allowed.has(canonicalizeUrl(item.url))) continue;
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

  // Verify the caller owns or edits this channel.
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { ownerId: true },
  });
  if (!channel) throw new NotFoundError("channel_not_found");
  if (channel.ownerId !== userId) {
    const editor = await prisma.channelEditor.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { userId: true },
    });
    if (!editor) throw new ForbiddenError("not_channel_author");
  }

  let post: PostResponse;
  try {
    post = await prisma.post.create({
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
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new ConflictError("post_id_collision");
    }
    throw error;
  }

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
    include: { media: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
  });
  if (!post) throw new NotFoundError();
  if (post.channel.ownerId !== userId && !await isChannelEditor(post.channel.id, userId)) {
    throw new ForbiddenError();
  }

  const urls = post.media.map((m) => canonicalizeUrl(m.url));

  const orphaned = await prisma.$transaction(async (tx) => {
    await tx.post.deleteMany({
      where: {
        id,
        OR: [
          { channel: { ownerId: userId } },
          { channel: { editors: { some: { userId } } } },
        ],
      },
    });
    // One query instead of one count per URL: any URL still present in Media
    // is referenced by another post and must not be deleted from storage.
    const stillReferenced = await tx.media.findMany({
      where: { url: { in: urls } },
      select: { url: true },
      distinct: ["url"],
    });
    const referenced = new Set(stillReferenced.map((m) => m.url));
    return urls.filter((url) => !referenced.has(url));
  });

  if (orphaned.length > 0) {
    await deleteMediaFiles(orphaned);
  }
}

export async function updatePost(
  id: string,
  userId: string,
  data: UpdatePostData,
): Promise<PostResponse> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId && !await isChannelEditor(existing.channel.id, userId)) {
    throw new NotFoundError();
  }

  const { media, ...postData } = data;
  if (media !== undefined) {
    await validateMediaOwnership(media, userId, existing.media.map((m) => m.url));
  }

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
      where: {
        id,
        OR: [
          { channel: { ownerId: userId } },
          { channel: { editors: { some: { userId } } } },
        ],
      },
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
    // One query instead of one count per URL (see deletePost).
    const stillReferenced = await prisma.media.findMany({
      where: { url: { in: removed } },
      select: { url: true },
      distinct: ["url"],
    });
    const referenced = new Set(stillReferenced.map((m) => m.url));
    const orphaned = removed.filter((url) => !referenced.has(url));
    await deleteMediaFiles(orphaned);
  }

  return post!;
}
