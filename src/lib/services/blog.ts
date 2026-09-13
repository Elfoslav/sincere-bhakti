import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { deletePendingUploads } from "@/lib/pending-upload";
import { canonicalizeUrl } from "@/lib/url";
import { isBlogPubliclyVisible } from "@/lib/blog";
import { sanitizeRichTextHtml } from "@/lib/rich-text-html";
import { isChannelEditor } from "@/lib/services/channel";
import { CHANNEL_AUTHOR_ROLES } from "@/lib/channel-roles";
import { resolveTranslation, type TranslationInfo } from "@/lib/channel-translation";
import { generateShortId } from "@/lib/id";
import { derivePostSlug, normalizeCategoryName } from "@/lib/validation";
import { resolveCategoryIds, setBlogPostCategories } from "@/lib/services/category";
import { ERROR_BLOG_ID_COLLISION } from "@/lib/error-messages";
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

export interface BlogPostResponse {
  id: string;
  shortId: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  content: string | null;
  contentHtml: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  language: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  channel: PostChannel;
  categories: CategoryRef[];
}

export interface GetBlogPostsParams {
  scope?: "public" | "private";
  cursor?: string;
  limit?: number;
  channelId?: string;
  language?: string;
  requestLanguage?: string;
  // Canonical UPPERCASE category name; normalized again server-side.
  category?: string;
}

export interface GetBlogPostsResult {
  posts: BlogPostResponse[];
  hasMore: boolean;
}

export interface CreateBlogPostData {
  id?: string;
  title: string;
  excerpt?: string;
  content?: string;
  coverUrl?: string;
  contentHtml?: string;
  isPublic?: boolean;
  language?: string;
  publishedAt?: Date;
  channelId?: string;
  categories?: string[];
}

export interface UpdateBlogPostData {
  title?: string;
  excerpt?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  contentHtml?: string | null;
  isPublic?: boolean;
  language?: string;
  publishedAt?: Date | null;
  // Undefined leaves categories alone; null or [] clears them.
  categories?: string[] | null;
}

export const blogPostInclude = {
  channel: {
    include: {
      translations: { select: { language: true, name: true, slug: true } },
    },
  },
  categories: { include: { category: { select: { id: true, name: true, slug: true, language: true } } } },
};

export function toBlogPostResponse<
  Raw extends {
    channel: { id: string; avatarUrl: string | null; ownerId: string; translations?: TranslationInfo[] };
    categories?: { category: { id: string; name: string; slug: string; language: string } }[];
  },
>(
  raw: Raw,
  language: string,
): Omit<Raw, "channel" | "categories"> & { channel: PostChannel; categories: CategoryRef[] } {
  const t = raw.channel.translations
    ? resolveTranslation(raw.channel.translations, language)
    : null;
  // Re-sanitize stored HTML on read (idempotent): rows that bypassed the
  // writer must never become stored XSS in feed cards — BlogExcerpt renders
  // contentHtml via dangerouslySetInnerHTML and can't sanitize client-side
  // (sanitize-html is Node-only, never bundled for the browser).
  const storedHtml = (raw as { contentHtml?: unknown }).contentHtml;
  return {
    ...raw,
    ...(typeof storedHtml === "string" ? { contentHtml: sanitizeRichTextHtml(storedHtml) } : {}),
    channel: {
      id: raw.channel.id,
      name: t?.name ?? "",
      slug: t?.slug ?? "",
      avatarUrl: raw.channel.avatarUrl,
      ownerId: raw.channel.ownerId,
    },
    categories: (raw.categories ?? []).map((c) => ({ id: c.category.id, name: c.category.name, slug: c.category.slug, language: c.category.language })),
  };
}

// Re-exported for existing importers; the canonical implementation lives in
// @/lib/blog so client components can use it without pulling in Prisma.
export { isBlogPubliclyVisible };

function publicVisibilityFilter(now: Date): Prisma.BlogPostWhereInput {  return {
    isPublic: true,
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

export async function getBlogPosts(
  params: GetBlogPostsParams,
  currentUserId?: string,
): Promise<GetBlogPostsResult> {
  const { scope, cursor, limit = 10, channelId, language, requestLanguage, category } = params;
  const now = new Date();

  const where: Prisma.BlogPostWhereInput = {};
  if (language) where.language = language;
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
    Object.assign(where, publicVisibilityFilter(now));
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
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel) throw new NotFoundError();
      where.channelId = channelId;
      if (channel.ownerId !== currentUserId && !await isChannelEditor(channelId, currentUserId)) {
        Object.assign(where, publicVisibilityFilter(now));
      }
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
      ];
    }
  }

  // List views (feed, channel lists, link pickers) never need the raw JSON
  // body: project it away so a page of cards doesn't haul up to ~60 KB of
  // markup per row. The rendered HTML stays — cards show formatted excerpts.
  // Single-entity lookups below keep the full include.
  const posts = await prisma.blogPost.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      shortId: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      coverUrl: true,
      isPublic: true,
      language: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      channelId: true,
      channel: blogPostInclude.channel,
      categories: { select: { category: { select: { id: true, name: true, slug: true, language: true } } } },
    },
  });

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  const resolvedLanguage = requestLanguage ?? "en";
  return {
    posts: posts.map((p) => toBlogPostResponse({ ...p, content: null }, resolvedLanguage)),
    hasMore,
  };
}

export async function getBlogPostById(id: string, language?: string): Promise<BlogPostResponse | null> {
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: blogPostInclude,
  });

  if (!post) return null;
  return toBlogPostResponse(post, language ?? "en");
}

export async function getBlogPostByShortId(shortId: string, language?: string): Promise<BlogPostResponse | null> {
  const post = await prisma.blogPost.findUnique({
    where: { shortId },
    include: blogPostInclude,
  });

  if (!post) return null;
  return toBlogPostResponse(post, language ?? "en");
}

// `generateMetadata` and the page body both need the same post data. React's
// cache memoizes the lookup within a request so we don't double-hit Prisma.
export const getCachedBlogPostById = cache(getBlogPostById);
export const getCachedBlogPostByShortId = cache(getBlogPostByShortId);

// How many times to regenerate a colliding server-generated shortId before
// giving up (a collision on an 8-hex id is already very unlikely).
const MAX_SHORT_ID_ATTEMPTS = 5;

/**
 * Prove the caller uploaded `coverUrl` themselves. Covers must live on the
 * app's storage domain (fail closed without it) and carry a PendingUpload
 * claim by this user — the same ownership model as post media. URLs in
 * `allowedUrls` (e.g. the post's unchanged cover on update) skip the check.
 *
 * Covers never create Media rows (only timeline-post media does), so the
 * PendingUpload claim is the only upload-time proof — and it is deleted on
 * link. Fall back to authorship of an article already referencing the URL so
 * reusing your own already-used cover doesn't throw "cover not owned".
 */
async function validateCoverOwnership(
  coverUrl: string,
  userId: string,
  allowedUrls: string[] = [],
): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  if (!storageDomain) throw new ForbiddenError("cover_not_owned");
  if (allowedUrls.map(canonicalizeUrl).includes(canonicalizeUrl(coverUrl))) return;
  const key = extractKey(coverUrl, storageDomain);
  if (!key) throw new ForbiddenError("cover_not_owned");
  const pending = await prisma.pendingUpload.findMany({
    where: { key: { in: [key] } },
    select: { key: true, userId: true },
  });
  const ownerId = pending.find((p) => p.key === key)?.userId;
  if (ownerId === userId) return;
  const prior = await prisma.blogPost.findFirst({
    where: { coverUrl: canonicalizeUrl(coverUrl) },
    select: { channel: { select: { id: true, ownerId: true } } },
  });
  if (prior && (prior.channel.ownerId === userId || await isChannelEditor(prior.channel.id, userId))) return;
  throw new ForbiddenError("cover_not_owned");
}

/**
 * Delete cover files from R2 that no remaining blog post references. Mirrors
 * the post media orphan check: one query for all URLs instead of one per URL.
 */
async function deleteOrphanedCovers(urls: string[]): Promise<void> {
  const canonical = urls.map(canonicalizeUrl);
  if (canonical.length === 0) return;
  const stillReferenced = await prisma.blogPost.findMany({
    where: { coverUrl: { in: canonical } },
    select: { coverUrl: true },
  });
  const referenced = new Set(
    stillReferenced.map((b) => b.coverUrl).filter((u): u is string => u !== null).map(canonicalizeUrl),
  );
  const orphaned = canonical.filter((url) => !referenced.has(url));
  if (orphaned.length > 0) {
    await deleteMediaFiles(orphaned);
  }
}

export async function createBlogPost(
  data: CreateBlogPostData,
  userId: string,
  requestLanguage?: string,
): Promise<BlogPostResponse> {
  const { id, title, excerpt, content, coverUrl, contentHtml, isPublic = true, language = "en", publishedAt, channelId, categories } = data;

  if (!title?.trim()) throw new ValidationError("title_required");
  if (!content && !excerpt) throw new ValidationError("blog_must_have_content_or_excerpt");
  if (coverUrl) await validateCoverOwnership(coverUrl, userId);

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

  const trimmedContent = content?.trim() || null;
  const trimmedExcerpt = excerpt?.trim() || null;
  const categoryIds = categories ? await resolveCategoryIds(prisma, categories, language) : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawPost: any;
  for (let attempt = 1; ; attempt++) {
    try {
      rawPost = await prisma.blogPost.create({
        data: {
          ...(id ? { id } : {}),
          shortId: generateShortId(),
          slug: derivePostSlug(title),
          title: title.trim(),
          // No summary is a valid state: cards fall back to the formatted
          // body (or a plain preview for legacy rows).
          excerpt: trimmedExcerpt,
          content: trimmedContent,
          coverUrl: coverUrl?.trim() || null,
          // Editor HTML is re-sanitized server-side: never trust client markup.
          contentHtml: sanitizeRichTextHtml(contentHtml?.trim()),
          isPublic,
          language,
          publishedAt: publishedAt ?? new Date(),
          channelId,
          categories: {
            create: categoryIds.map((categoryId) => ({ category: { connect: { id: categoryId } } })),
          },
        },
        include: blogPostInclude,
      });
      break;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
        const onShortId = Array.isArray(target)
          ? target.includes("shortId")
          : typeof target === "string" && target.includes("shortId");
        if (onShortId && attempt < MAX_SHORT_ID_ATTEMPTS) continue;
        throw new ConflictError(ERROR_BLOG_ID_COLLISION);
      }
      throw error;
    }
  }

  // Remove the PendingUpload claim for the newly linked cover.
  if (coverUrl) {
    await deletePendingUploads([coverUrl]);
  }

  return toBlogPostResponse(rawPost, requestLanguage ?? "en") as BlogPostResponse;
}

export async function deleteBlogPost(
  id: string,
  userId: string,
): Promise<void> {
  const post = await prisma.blogPost.findUnique({
    where: { id },
    select: { id: true, coverUrl: true, channel: { select: { id: true, ownerId: true } } },
  });
  if (!post) throw new NotFoundError();
  // 404 (not 403) for strangers: matches updateBlogPost so delete doesn't
  // oracle private-object existence.
  if (post.channel.ownerId !== userId && !await isChannelEditor(post.channel.id, userId)) {
    throw new NotFoundError();
  }

  // Re-check ownership in the write itself and gate the cascade on it: a
  // revocation between the pre-fetch above and this write must not destroy
  // the article's promo posts while deleting zero article rows.
  const { count } = await prisma.blogPost.deleteMany({
    where: {
      id,
      OR: [
        { channel: { ownerId: userId } },
        { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
      ],
    },
  });
  if (count === 0) throw new NotFoundError();

  // Remove timeline promo posts: without their article they'd remain as empty
  // feed posts (SetNull only unlinks them).
  await prisma.post.deleteMany({
    where: { blogPostId: id },
  });

  if (post.coverUrl) {
    await deleteOrphanedCovers([post.coverUrl]);
  }
}

export async function updateBlogPost(
  id: string,
  userId: string,
  data: UpdateBlogPostData,
  requestLanguage?: string,
): Promise<BlogPostResponse> {
  const existing = await prisma.blogPost.findUnique({
    where: { id },
    select: { id: true, title: true, excerpt: true, content: true, coverUrl: true, language: true, channel: { select: { id: true, ownerId: true } } },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId && !await isChannelEditor(existing.channel.id, userId)) {
    throw new NotFoundError();
  }

  if (data.coverUrl !== undefined && data.coverUrl) {
    await validateCoverOwnership(data.coverUrl, userId, existing.coverUrl ? [existing.coverUrl] : []);
  }

  const postData: Prisma.BlogPostUpdateManyMutationInput = {};
  if (data.title !== undefined) {
    if (!data.title.trim()) throw new ValidationError("title_required");
    postData.title = data.title.trim();
    postData.slug = derivePostSlug(data.title) ?? null;
  }
  if (data.excerpt !== undefined) postData.excerpt = data.excerpt?.trim() || null;
  if (data.content !== undefined) postData.content = data.content?.trim() || null;
  if (data.coverUrl !== undefined) postData.coverUrl = data.coverUrl?.trim() || null;
  if (data.contentHtml !== undefined) postData.contentHtml = sanitizeRichTextHtml(data.contentHtml?.trim());
  if (data.isPublic !== undefined) postData.isPublic = data.isPublic;
  if (data.language !== undefined) postData.language = data.language;
  if (data.publishedAt !== undefined) postData.publishedAt = data.publishedAt;

  const nextExcerpt = (data.excerpt !== undefined ? postData.excerpt : existing.excerpt) as
    | string
    | null
    | undefined;
  const nextContent = (data.content !== undefined ? postData.content : existing.content) as
    | string
    | null
    | undefined;
  if (!nextExcerpt && !nextContent) {
    throw new ValidationError("blog_must_have_content_or_excerpt");
  }

  const ownershipFilter: Prisma.BlogPostWhereInput = {
    id,
    OR: [
      { channel: { ownerId: userId } },
      { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
    ],
  };

  // Scalar + relation writes share one transaction guarded by the same
  // ownership filter: a role revoked between the pre-fetch above and this
  // write fails closed instead of mutating categories on a row we no longer
  // own. A categories-only patch carries no scalar changes (Prisma rejects
  // empty data), so it proves ownership with a scoped count first.
  await prisma.$transaction(async (tx) => {
    if (Object.keys(postData).length > 0) {
      const { count } = await tx.blogPost.updateMany({ where: ownershipFilter, data: postData });
      if (count === 0) throw new NotFoundError();
    } else {
      const owned = await tx.blogPost.count({ where: ownershipFilter });
      if (owned === 0) throw new NotFoundError();
    }
    if (data.categories !== undefined) {
      // Resolved inside the transaction: a stranger's rejected patch must
      // not create global taxonomy rows as a side effect. Links resolve in
      // the article's (possibly newly patched) language.
      await setBlogPostCategories(tx, id, await resolveCategoryIds(tx, data.categories ?? [], data.language ?? existing.language));
    }
  });

  const updated = await prisma.blogPost.findUnique({
    where: { id },
    include: blogPostInclude,
  });

  if (data.coverUrl !== undefined && data.coverUrl) {
    // Remove the PendingUpload claim for the newly linked cover.
    await deletePendingUploads([data.coverUrl]);
  }
  const nextCover = data.coverUrl !== undefined ? data.coverUrl : existing.coverUrl;
  if (existing.coverUrl && canonicalizeUrl(existing.coverUrl) !== (nextCover ? canonicalizeUrl(nextCover) : nextCover)) {
    // Cover replaced or removed: delete the old file when orphaned.
    await deleteOrphanedCovers([existing.coverUrl]);
  }

  return toBlogPostResponse(updated!, requestLanguage ?? "en");
}
