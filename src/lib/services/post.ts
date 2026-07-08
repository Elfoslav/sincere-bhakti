import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import type { Prisma } from "@prisma/client";

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

export interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
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
  author: PostAuthor;
  media: PostMedia[];
}

export interface GetPostsParams {
  scope?: "public";
  cursor?: string;
  limit?: number;
  authorId?: string;
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
}

export interface UpdatePostData {
  content?: string | null;
  isPublic?: boolean;
  media?: MediaInput[];
}

const postInclude = {
  author: { select: { id: true, name: true, image: true } },
  media: { orderBy: { position: "asc" as const } },
};

export async function getPosts(
  params: GetPostsParams,
  currentUserId?: string,
): Promise<GetPostsResult> {
  const { scope, cursor, limit = 10, authorId, language } = params;

  const where: Prisma.PostWhereInput = {};
  if (language) where.language = language;

  if (scope === "public") {
    where.isPublic = true;
    if (authorId) where.authorId = authorId;
  } else {
    if (!currentUserId) throw new UnauthorizedError();
    // Private scope: a user may only see their own posts (public + private).
    // When requesting another user's posts, restrict to public ones so
    // private posts never leak via an `authorId` query param.
    if (authorId && authorId !== currentUserId) {
      where.authorId = authorId;
      where.isPublic = true;
    } else {
      where.authorId = currentUserId;
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

function canonicalizeUrl(url: string): string {
  return url.split("?")[0].split("#")[0];
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

  for (const { item, key } of storageUrls) {
    const url = canonicalizeUrl(item.url);
    const record = existing.find((r) => canonicalizeUrl(r.url) === url);
    if (record && record.userId !== userId) {
      throw new ForbiddenError("media_not_owned");
    }
  }
}

export async function createPost(
  data: CreatePostData,
  userId: string,
): Promise<PostResponse> {
  const { id, content, media = [], isPublic = true, language = "en" } = data;
  await validateMediaOwnership(media, userId);

  const post = await prisma.post.create({
    data: {
      ...(id ? { id } : {}),
      content: content || null,
      isPublic,
      language,
      authorId: userId,
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

  return post;
}

export async function deletePost(
  id: string,
  userId: string,
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { url: true } } },
  });
  if (!post) throw new NotFoundError();
  if (post.authorId !== userId) throw new ForbiddenError();

  const urls = post.media.map((m) => canonicalizeUrl(m.url));
  const counts = await Promise.all(
    urls.map((url) => prisma.media.count({ where: { url } })),
  );

  await prisma.post.deleteMany({ where: { id, authorId: userId } });

  const orphaned = urls.filter((_, i) => counts[i] <= 1);
  await deleteMediaFiles(orphaned);
}

export async function updatePost(
  id: string,
  userId: string,
  data: UpdatePostData,
): Promise<PostResponse> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { url: true } } },
  });
  if (!existing) throw new NotFoundError();

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
      where: { id, authorId: userId },
      data: postData,
    });

    if (count === 0) {
      const exists = await tx.post.findUnique({ where: { id } });
      if (!exists) throw new NotFoundError();
      throw new ForbiddenError();
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
    const removed = existing.media
      .filter(
        (old) => !media.some((m) => canonicalizeUrl(m.url) === canonicalizeUrl(old.url)),
      )
      .map((m) => canonicalizeUrl(m.url));
    const counts = await Promise.all(
      removed.map((url) => prisma.media.count({ where: { url } })),
    );
    const orphaned = removed.filter((_, i) => counts[i] <= 1);
    await deleteMediaFiles(orphaned);
  }

  return post!;
}
