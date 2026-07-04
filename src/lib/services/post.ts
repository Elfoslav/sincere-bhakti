import { prisma } from "@/lib/prisma";

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

export interface CreatePostData {
  content?: string;
  media?: { url: string; type: string }[];
  isPublic?: boolean;
  language?: string;
}

const postInclude = {
  author: { select: { id: true, name: true, image: true } },
  media: { orderBy: { position: "asc" as const } },
};

export async function getPosts(
  params: GetPostsParams,
  currentUserId?: string,
): Promise<GetPostsResult> {
  const { scope, cursor, limit = 10, authorId } = params;

  if (scope === "public") {
    const where: Record<string, unknown> = { isPublic: true };
    if (authorId) where.authorId = authorId;
    if (params.language) where.language = params.language;

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

  if (!currentUserId) {
    throw new UnauthorizedError();
  }

  const posts = await prisma.post.findMany({
    where: { authorId: currentUserId },
    orderBy: { createdAt: "desc" },
    include: postInclude,
  });

  return { posts, hasMore: false };
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
  const result = await prisma.post.deleteMany({
    where: { id, authorId: userId },
  });

  if (result.count === 0) {
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    throw new ForbiddenError();
  }
}
