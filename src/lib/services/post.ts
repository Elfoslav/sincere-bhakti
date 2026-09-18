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
import {
  derivePostSlugFromContent,
  isUrlOnlyContent,
  normalizeCategoryName,
} from "@/lib/validation";
import { getFirstUrl } from "@/lib/autolink";
import { parseYouTubeUrl } from "@/lib/video";
import { parseLinkPreview } from "@/lib/link-preview";
import { fetchRemoteBytes } from "@/lib/remote-fetch";
import { resolveCategoryIds, setPostCategories } from "@/lib/services/category";
import { resolveFeedScopeWhere } from "@/lib/services/feed-scope";
import { ERROR_POST_ID_COLLISION } from "@/lib/error-messages";
import type { Prisma } from "@prisma/client";
import type { PostChannel } from "@/types/post";
import type { CategoryRef } from "@/types/category";

// Re-exported so existing importers (routes, tests) keep working — the
// canonical classes live in @/lib/services/errors, shared with the blog
// service so instanceof checks cross the module boundary.
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@/lib/services/errors";
export { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, ConflictError };

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
  blogPostId: string | null;
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
  linkTitle?: string;
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
  linkTitle?: string | null;
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
  T extends { blogPost: BlogPostResponse | null; blogPostId?: string | null },
>(
  response: T,
  rawBlogPost: { isPublic: boolean; publishedAt: Date | string | null; channel: { id: string; ownerId: string } } | null | undefined,
  viewerId?: string,
): Promise<T> {
  // No link or a dangling link (relation null): never leak the scalar —
  // the inconsistent state is exactly where the guard must stay defensive.
  if (!response.blogPost || !rawBlogPost) return { ...response, blogPost: null, blogPostId: null };
  if (isBlogPubliclyVisible(rawBlogPost)) return response;
  if (viewerId) {
    if (rawBlogPost.channel.ownerId === viewerId) return response;
    if (await isChannelEditor(rawBlogPost.channel.id, viewerId)) return response;
  }
  // Null the object AND the scalar: leaking blogPostId tells anonymous
  // callers a private article's id and its linkage (detail still 404s).
  return { ...response, blogPost: null, blogPostId: null };
}

export async function getPosts(
  params: GetPostsParams,
  currentUserId?: string,
): Promise<GetPostsResult> {
  const { scope, cursor, limit = 10, channelId, language, requestLanguage, blogPostId, category } = params;
  const now = new Date();

  if (blogPostId) {
    // Existence gate: without it, ?blogPostId=<guess> oracles private
    // article ids (a public promo row vs an empty set). Only proceed when
    // the linked article is publicly visible or the viewer authors its
    // channel — otherwise return empty (a list filter, never a 404).
    const linked = await prisma.blogPost.findUnique({
      where: { id: blogPostId },
      select: { isPublic: true, publishedAt: true, channel: { select: { id: true, ownerId: true } } },
    });
    const openlyVisible = !!linked && isBlogPubliclyVisible(linked);
    const authored = !!linked && !!currentUserId &&
      (linked.channel.ownerId === currentUserId || await isChannelEditor(linked.channel.id, currentUserId));
    if (!openlyVisible && !authored) return { posts: [], hasMore: false };
  }

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

  // Scope/visibility lives in the shared feed-scope helper (same shape as
  // the blog feed) — the keys never overlap the filters applied above.
  Object.assign(where, await resolveFeedScopeWhere({ scope, channelId, currentUserId }, now));

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

// Best-effort server-side title resolver for URL-only posts when the client
// didn't supply `linkTitle` (e.g. API clients). Only triggered for url-only
// content. Uses guarded fetch with a short timeout so post creation never
// blocks long on a slow upstream.
async function fetchLinkTitleForContent(
  content: string | null | undefined,
  supplied: string | null | undefined,
): Promise<string | undefined> {
  const trimmedSupplied = supplied?.trim();
  if (trimmedSupplied) return trimmedSupplied;
  if (!content || !isUrlOnlyContent(content)) return undefined;
  const url = getFirstUrl(content);
  if (!url) return undefined;

  // YouTube oEmbed is lighter and more reliable than scraping watch pages
  // (which often require consent walls for bots).
  if (parseYouTubeUrl(url)) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const fetched = await fetchRemoteBytes(oembedUrl, { maxBytes: 16 * 1024, timeoutMs: 1500 });
      if (fetched) {
        const json = JSON.parse(fetched.bytes.toString("utf8")) as { title?: string };
        if (json.title?.trim()) return json.title.trim();
      }
    } catch {
      // fall through to OG fetch
    }
  }

  try {
    const fetched = await fetchRemoteBytes(url, { maxBytes: 512 * 1024, timeoutMs: 1500 });
    if (!fetched) return undefined;
    const preview = parseLinkPreview(fetched.bytes.toString("utf8"), fetched.finalUrl ?? url);
    return preview.title ?? undefined;
  } catch {
    return undefined;
  }
}

export async function createPost(
  data: CreatePostData,
  userId: string,
  requestLanguage?: string,
): Promise<PostResponse> {
  const { id, content, media = [], isPublic = true, language = "en", publishedAt, channelId, blogPostId, categories, linkTitle } = data;
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
  const resolvedLinkTitle = await fetchLinkTitleForContent(content, linkTitle);

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
          slug: derivePostSlugFromContent(content, resolvedLinkTitle),
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
        throw new ConflictError(ERROR_POST_ID_COLLISION);
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
  // 404 (not 403) for strangers: matches updatePost so delete doesn't
  // oracle private-object existence.
  if (post.channel.ownerId !== userId && !await isChannelEditor(post.channel.id, userId)) {
    throw new NotFoundError();
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
    select: { language: true, content: true, media: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId && !await isChannelEditor(existing.channel.id, userId)) {
    throw new NotFoundError();
  }

  const { media, categories, linkTitle, ...rest } = data;
  if (media !== undefined) {
    await validateMediaOwnership(media, userId, existing.media.map((m) => m.url));
  }
  if (rest.blogPostId) {
    await validateBlogLink(rest.blogPostId, existing.channel.id);
  }

  const postData: Prisma.PostUpdateManyMutationInput = { ...rest };
  // Recompute slug when content changes (or when a linkTitle is supplied
  // for a URL-only post without content change). Otherwise leave slug as-is.
  if (rest.content !== undefined || linkTitle !== undefined) {
    const slugContent = rest.content !== undefined ? rest.content : existing.content;
    const resolvedTitle = await fetchLinkTitleForContent(slugContent, linkTitle ?? undefined);
    postData.slug = derivePostSlugFromContent(slugContent, resolvedTitle) ?? null;
    // linkTitle-only updates must not touch the content column.
    if (rest.content === undefined) {
      delete (postData as Record<string, unknown>).content;
    }
  }

  const ownershipFilter: Prisma.PostWhereInput = {
    id,
    OR: [
      { channel: { ownerId: userId } },
      { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
    ],
  };

  // Prove ownership FIRST inside the transaction, then write relations: a
  // role revoked between the pre-fetch above and this write fails closed
  // before any category/media mutation lands. A categories/media-only patch
  // carries no scalar changes (Prisma rejects empty data), so it proves
  // ownership with a scoped count. Throwing rolls the whole transaction back.
  const post = await prisma.$transaction(async (tx) => {
    if (Object.keys(postData).length > 0) {
      const { count } = await tx.post.updateMany({ where: ownershipFilter, data: postData });
      if (count === 0) throw new NotFoundError();
    } else {
      const owned = await tx.post.count({ where: ownershipFilter });
      if (owned === 0) throw new NotFoundError();
    }

    if (categories !== undefined) {
      // Resolved inside the transaction: a stranger's rejected patch must
      // not create global taxonomy rows as a side effect.
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
