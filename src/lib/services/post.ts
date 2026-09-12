import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { deletePendingUploads } from "@/lib/pending-upload";
import { canonicalizeUrl } from "@/lib/url";
import { isChannelEditor } from "@/lib/services/channel";
import { isBlogPubliclyVisible } from "@/lib/blog";
import { blogPostInclude, toBlogPostResponse, type BlogPostResponse } from "@/lib/services/blog";
import { CHANNEL_AUTHOR_ROLES } from "@/lib/channel-roles";
import { resolveTranslation, type TranslationInfo } from "@/lib/channel-translation";
import { generateShortId } from "@/lib/id";
import { derivePostSlug, normalizeCategoryName } from "@/lib/validation";
import { resolveCategoryIds, setPostCategories } from "@/lib/services/category";
import type { Prisma } from "@prisma/client";
import type { PostChannel } from "@/types/post";
import type { CategoryRef } from "@/types/category";

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
  shortId: string;
  slug: string | null;
  content: string | null;
  isPublic: boolean;
  language: string;
  // Null = visible immediately; a future date hides the post from public
  // feeds until then (timeline promos of scheduled articles).
  publishedAt: Date | null;
  createdAt: Date;
  channel: PostChannel;
  media: PostMedia[];
  blogPost: BlogPostResponse | null;
  categories: CategoryRef[];
}

export interface GetPostsParams {
  scope?: "public" | "private";
  cursor?: string;
  limit?: number;
  channelId?: string;
  language?: string;
  requestLanguage?: string;
  blogPostId?: string;
  // Canonical UPPERCASE category name; normalized again server-side.
  category?: string;
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
  publishedAt?: Date | null;
  channelId?: string;
  blogPostId?: string;
  categories?: string[];
}

export interface UpdatePostData {
  content?: string | null;
  isPublic?: boolean;
  media?: MediaInput[];
  language?: string;
  publishedAt?: Date | null;
  blogPostId?: string | null;
  // Undefined leaves categories alone; null or [] clears them.
  categories?: string[] | null;
}

const postInclude = {
  channel: {
    include: {
      translations: { select: { language: true, name: true, slug: true } },
    },
  },
  media: { orderBy: { position: "asc" as const } },
  blogPost: { include: blogPostInclude },
  categories: { include: { category: { select: { id: true, name: true, slug: true, language: true } } } },
};

function toPostResponse<
  Raw extends {
    channel: { id: string; avatarUrl: string | null; ownerId: string; translations?: TranslationInfo[] };
    blogPost?: { channel: { id: string; avatarUrl: string | null; ownerId: string; translations?: TranslationInfo[] } } | null;
    categories?: { category: { id: string; name: string; slug: string; language: string } }[];
  },
>(
  raw: Raw,
  language: string,
): Omit<Raw, "channel" | "blogPost" | "categories"> & { channel: PostChannel; blogPost: BlogPostResponse | null; categories: CategoryRef[] } {
  const t = raw.channel.translations
    ? resolveTranslation(raw.channel.translations, language)
    : null;
  return {
    ...raw,
    channel: {
      id: raw.channel.id,
      name: t?.name ?? "",
      slug: t?.slug ?? "",
      avatarUrl: raw.channel.avatarUrl,
      ownerId: raw.channel.ownerId,
    },
    // The constraint only names the channel shape; the runtime payload carries
    // the full article (spread inside toBlogPostResponse), hence the cast.
    // Callers MUST null this for viewers who may not see the article (see
    // hidePrivateBlogPost below) — serializing it unconditionally leaks
    // private/scheduled articles through public post responses.
    blogPost: raw.blogPost
      ? (toBlogPostResponse(raw.blogPost, language) as unknown as BlogPostResponse)
      : null,
    categories: (raw.categories ?? []).map((c) => ({ id: c.category.id, name: c.category.name, slug: c.category.slug, language: c.category.language })),
  };
}

/**
 * Null a linked article the viewer may not see. A public timeline post can
 * otherwise leak a private/scheduled article's title, body, cover, and
 * categories via the public post API (the UI hides the preview, but the JSON
 * still carried it). This happens through the blogPostId link or by making an
 * already-promoted article private afterwards.
 *
 * Keep the article when it is publicly visible, or when the viewer authors
 * its channel (owner fast-path, editor lookup otherwise). The post and its
 * article always share a channel (enforced at link time), so authoring either
 * implies authoring both.
 */
async function hidePrivateBlogPost<
  T extends { blogPost: BlogPostResponse | null },
>(
  response: T,
  rawBlogPost: { isPublic: boolean; publishedAt: Date | string | null; channel: { id: string; ownerId: string } } | null | undefined,
  viewerId?: string,
): Promise<T> {
  if (!response.blogPost || !rawBlogPost) return response;
  if (isBlogPubliclyVisible(rawBlogPost)) return response;
  if (viewerId) {
    if (rawBlogPost.channel.ownerId === viewerId) return response;
    if (await isChannelEditor(rawBlogPost.channel.id, viewerId)) return response;
  }
  return { ...response, blogPost: null };
}

/**
 * Public timeline visibility: flagged public with no (or a past) publish
 * date. Scheduled promos (future date) stay out of public feeds until their
 * article goes live — no cron needed, the date comparison does it.
 */
function postPublicVisibilityFilter(now: Date): Prisma.PostWhereInput {
  return {
    isPublic: true,
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

export async function getPosts(
  params: GetPostsParams,
  currentUserId?: string,
): Promise<GetPostsResult> {
  const { scope, cursor, limit = 10, channelId, language, requestLanguage, blogPostId, category } = params;
  const now = new Date();

  const where: Prisma.PostWhereInput = {};
  if (language) where.language = language;
  if (blogPostId) where.blogPostId = blogPostId;
  if (category?.trim()) {
    // A category only ever matches its own language: scope to the feed
    // language when the caller filters by one.
    where.categories = {
      some: {
        category: {
          name: normalizeCategoryName(category),
          ...(language ? { language } : {}),
        },
      },
    };
  }

  if (scope === "public") {
    // Public feeds show only immediately visible posts: flagged public with
    // no (or a past) publish date. Scheduled promos stay out until go-live.
    Object.assign(where, postPublicVisibilityFilter(now));
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
        { channel: { editors: { some: { userId: currentUserId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
      ];
    }
    // Private tab: drafts + scheduled (public flag off, or publish date in future).
    where.AND = [
      {
        OR: [{ isPublic: false }, { publishedAt: { gt: now } }],
      },
    ];
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
        Object.assign(where, postPublicVisibilityFilter(now));
      }
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
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

  const resolvedLanguage = requestLanguage ?? "en";
  const visible = await Promise.all(
    posts.map(async (p) => hidePrivateBlogPost(toPostResponse(p, resolvedLanguage), p.blogPost, currentUserId)),
  );
  return {
    posts: visible,
    hasMore,
  };
}

export async function getPostById(id: string, language?: string, currentUserId?: string): Promise<PostResponse | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });

  if (!post) return null;
  return hidePrivateBlogPost(toPostResponse(post, language ?? "en"), post.blogPost, currentUserId);
}

export async function getPostByShortId(shortId: string, language?: string, currentUserId?: string): Promise<PostResponse | null> {
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: postInclude,
  });

  if (!post) return null;
  return hidePrivateBlogPost(toPostResponse(post, language ?? "en"), post.blogPost, currentUserId);
}

// `generateMetadata` and the page body both need the same post data. React's
// cache memoizes the lookup within a request so we don't double-hit Prisma.
export const getCachedPostById = cache(getPostById);
export const getCachedPostByShortId = cache(getPostByShortId);

async function validateMediaOwnership(
  media: MediaInput[],
  userId: string,
  allowedUrls: string[] = [],
): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  if (!storageDomain) {
    // Can't verify ownership of hosted media without the storage origin.
    // youtube embeds carry no ownership; anything else is rejected (fail closed).
    if (media.some((m) => m.type !== "youtube")) throw new ForbiddenError();
    return;
  }

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

// How many times to regenerate a colliding server-generated shortId before
// giving up (a collision on an 8-hex id is already very unlikely).
const MAX_SHORT_ID_ATTEMPTS = 5;

/**
 * Validate a promoted blog article link: the article must exist and belong
 * to the same channel as the post (the caller already proved authorship of
 * that channel). Same-channel keeps visibility coherent — excerpt rendering
 * is additionally guarded per viewer by isBlogPubliclyVisible.
 */
async function validateBlogLink(blogPostId: string, channelId: string): Promise<void> {
  const blog = await prisma.blogPost.findUnique({
    where: { id: blogPostId },
    select: { id: true, channelId: true },
  });
  if (!blog) throw new NotFoundError("blog_not_found");
  if (blog.channelId !== channelId) throw new ValidationError("blog_channel_mismatch");
}

export async function createPost(
  data: CreatePostData,
  userId: string,
  requestLanguage?: string,
): Promise<PostResponse> {
  const { id, content, media = [], isPublic = true, language = "en", publishedAt, channelId, blogPostId, categories } = data;
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
      select: { role: true },
    });
    if (!editor || !(CHANNEL_AUTHOR_ROLES as readonly string[]).includes(editor.role)) {
      throw new ForbiddenError("not_channel_author");
    }
  }

  if (blogPostId) await validateBlogLink(blogPostId, channelId);

  const categoryIds = categories ? await resolveCategoryIds(prisma, categories, language) : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawPost: any;
  // shortId is a server-generated 8-char id on a UNIQUE column. A collision is
  // rare but possible, so regenerate and retry a bounded number of times rather
  // than failing the user's post. A collision on a client-supplied `id` (or
  // exhausted retries) surfaces as a conflict.
  for (let attempt = 1; ; attempt++) {
    try {
      rawPost = await prisma.post.create({
        data: {
          ...(id ? { id } : {}),
          shortId: generateShortId(),
          slug: derivePostSlug(content),
          content: content || null,
          isPublic,
          language,
          publishedAt: publishedAt ?? null,
          channelId,
          ...(blogPostId ? { blogPostId } : {}),
          categories: {
            create: categoryIds.map((categoryId) => ({ category: { connect: { id: categoryId } } })),
          },
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
      break;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
        const onShortId = Array.isArray(target)
          ? target.includes("shortId")
          : typeof target === "string" && target.includes("shortId");
        if (onShortId && attempt < MAX_SHORT_ID_ATTEMPTS) continue;
        throw new ConflictError("post_id_collision");
      }
      throw error;
    }
  }

  // Remove PendingUpload records for the newly created media
  await deletePendingUploads(media.map((m) => m.url));

  return toPostResponse(rawPost, requestLanguage ?? "en") as PostResponse;
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
          { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
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
  requestLanguage?: string,
): Promise<PostResponse> {
  const existing = await prisma.post.findUnique({
    where: { id },
    select: { language: true, media: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId && !await isChannelEditor(existing.channel.id, userId)) {
    throw new NotFoundError();
  }

  const { media, categories, ...rest } = data;
  if (media !== undefined) {
    await validateMediaOwnership(media, userId, existing.media.map((m) => m.url));
  }
  if (rest.blogPostId) {
    await validateBlogLink(rest.blogPostId, existing.channel.id);
  }

  const postData: Prisma.PostUpdateManyMutationInput = { ...rest };
  if (rest.content !== undefined) {
    // Recompute the slug whenever content changes; clear it (null) when the new
    // content has no slug-able characters.
    postData.slug = derivePostSlug(rest.content) ?? null;
  }

  const post = await prisma.$transaction(async (tx) => {
    if (categories !== undefined) {
      // Links resolve in the post's (possibly newly patched) language.
      await setPostCategories(tx, id, await resolveCategoryIds(tx, categories ?? [], data.language ?? existing.language));
    }
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

    // A categories/media-only patch carries no scalar changes: skip the
    // no-op update (Prisma rejects empty data). Ownership was already
    // verified against the pre-update row above.
    let count = 1;
    if (Object.keys(postData).length > 0) {
      ({ count } = await tx.post.updateMany({
        where: {
          id,
          OR: [
            { channel: { ownerId: userId } },
            { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
          ],
        },
        data: postData,
      }));
    }

    if (count === 0) {
      throw new NotFoundError();
    }

    const updated = await tx.post.findUnique({
      where: { id },
      include: postInclude,
    })!;

    if (updated && !updated.content && updated.media.length === 0 && !updated.blogPostId) {
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

  return toPostResponse(post!, requestLanguage ?? "en");
}
