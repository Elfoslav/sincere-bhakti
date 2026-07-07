import { prisma } from "@/lib/prisma";
import { deleteMediaFiles } from "@/lib/services/upload";
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

export async function createPost(
  data: CreatePostData,
  userId: string,
): Promise<PostResponse> {
  const { content, media = [], isPublic = true, language = "en" } = data;

  const post = await prisma.post.create({
    data: {
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

  await prisma.post.deleteMany({ where: { id, authorId: userId } });
  await deleteMediaFiles(post.media.map((m) => m.url));
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
  if (existing.authorId !== userId) throw new ForbiddenError();

  const { media, ...postData } = data;

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

    return tx.post.update({
      where: { id },
      data: postData,
      include: postInclude,
    });
  });

  if (media !== undefined) {
    const removed = existing.media.filter(
      (old) => !media.some((m) => m.url.split("#")[0] === old.url.split("#")[0]),
    );
    await deleteMediaFiles(removed.map((m) => m.url));
  }

  return post;
}
