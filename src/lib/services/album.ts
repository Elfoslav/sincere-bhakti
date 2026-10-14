import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { filterOrphanedMediaUrls } from "@/lib/services/media-refs";
import { deletePendingUploads } from "@/lib/pending-upload";
import { canonicalizeUrl } from "@/lib/url";
import { isChannelEditor } from "@/lib/services/channel";
import { CHANNEL_AUTHOR_ROLES } from "@/lib/channel-roles";
import { resolveTranslation, type TranslationInfo } from "@/lib/channel-translation";
import { generateShortId } from "@/lib/id";
import { derivePostSlug } from "@/lib/validation";
import { ALBUM_SLUG_MAX_LENGTH } from "@/lib/validation";
import { resolveFeedScopeWhere } from "@/lib/services/feed-scope";
import { ERROR_ALBUM_ID_COLLISION } from "@/lib/error-messages";
import type { Prisma } from "@prisma/client";
import type { PostChannel } from "@/types/post";
import type { AlbumItem, AlbumMediaType } from "@/types/album";

// Re-exported so route handlers map errors with instanceof — the canonical
// classes live in @/lib/services/errors, shared with post/blog services.
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@/lib/services/errors";
export { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, ConflictError };

export interface AlbumResponse {
  id: string;
  shortId: string;
  slug: string | null;
  title: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  isPublic: boolean;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  channel: PostChannel;
  items: AlbumItem[];
}

export interface GetAlbumsParams {
  scope?: "public" | "private";
  cursor?: string;
  limit?: number;
  channelId?: string;
  language?: string;
  requestLanguage?: string;
}

export interface GetAlbumsResult {
  posts: AlbumResponse[];
  hasMore: boolean;
}

export interface AlbumMediaInput {
  url: string;
  type: string;
  width?: number;
  height?: number;
}

export interface CreateAlbumData {
  id?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  channelId?: string;
  media?: AlbumMediaInput[];
  isPublic?: boolean;
  language?: string;
}

export interface UpdateAlbumData {
  title?: string;
  description?: string | null;
  coverUrl?: string | null;
  media?: AlbumMediaInput[];
  isPublic?: boolean;
  language?: string;
}

const albumInclude = {
  channel: {
    include: {
      translations: { select: { language: true, name: true, slug: true } },
    },
  },
  items: { orderBy: { position: "asc" as const } },
};

function toAlbumResponse<
  Raw extends {
    items: { url: string; type: string; position: number; width: number | null; height: number | null }[];
    channel: { id: string; avatarUrl: string | null; ownerId: string; translations?: TranslationInfo[] };
  },
>(
  raw: Raw,
  language: string,
): Omit<Raw, "channel" | "items"> & { channel: PostChannel; items: AlbumItem[]; itemCount: number } {
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
    items: raw.items.map((i) => ({
      url: i.url,
      type: i.type as AlbumMediaType,
      position: i.position,
      width: i.width,
      height: i.height,
    })),
    itemCount: raw.items.length,
  };
}

export async function getAlbums(
  params: GetAlbumsParams,
  currentUserId?: string,
): Promise<GetAlbumsResult> {
  const { scope, cursor, limit = 10, channelId, language, requestLanguage } = params;
  const now = new Date();

  const where: Prisma.AlbumWhereInput = {};
  if (language) where.language = language;

  // Same visibility semantics as posts/blog: strangers see public rows only.
  Object.assign(where, await resolveFeedScopeWhere({ scope, channelId, currentUserId, supportsScheduling: false }, now));

  const albums = await prisma.album.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: albumInclude,
  });

  const hasMore = albums.length > limit;
  if (hasMore) albums.pop();

  const resolvedLanguage = requestLanguage ?? "en";
  return {
    posts: albums.map((a) => toAlbumResponse(a, resolvedLanguage)),
    hasMore,
  };
}

export async function getAlbumById(id: string, language?: string): Promise<AlbumResponse | null> {
  const album = await prisma.album.findUnique({
    where: { id },
    include: albumInclude,
  });
  if (!album) return null;
  return toAlbumResponse(album, language ?? "en");
}

export async function getAlbumByShortId(shortId: string, language?: string): Promise<AlbumResponse | null> {
  const album = await prisma.album.findUnique({
    where: { shortId },
    include: albumInclude,
  });
  if (!album) return null;
  return toAlbumResponse(album, language ?? "en");
}

// `generateMetadata` and the page body both need the same album data. React's
// cache memoizes the lookup within a request so we don't double-hit Prisma.
export const getCachedAlbumById = cache(getAlbumById);
export const getCachedAlbumByShortId = cache(getAlbumByShortId);

async function validateAlbumMediaOwnership(
  media: AlbumMediaInput[],
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

  const storageUrls: { item: AlbumMediaInput; key: string }[] = [];
  for (const item of media) {
    const key = extractKey(item.url, storageDomain);
    if (key) storageUrls.push({ item, key });
  }
  if (storageUrls.length === 0) return;

  // Check existing items in DB — if a record exists with a different userId,
  // reject. Posts share the R2 namespace, so a photo already used in someone
  // else's post can't be claimed by an album either (and vice versa).
  const allowed = new Set(allowedUrls.map(canonicalizeUrl));
  const [existing, existingPosts] = await Promise.all([
    prisma.albumItem.findMany({
      where: { url: { in: storageUrls.map((s) => canonicalizeUrl(s.item.url)) } },
      select: { url: true, userId: true },
    }),
    prisma.media.findMany({
      where: { url: { in: storageUrls.map((s) => canonicalizeUrl(s.item.url)) } },
      select: { url: true, userId: true },
    }),
  ]);
  const claimed = [...existing, ...existingPosts];

  for (const { item } of storageUrls) {
    const url = canonicalizeUrl(item.url);
    if (allowed.has(url)) continue;
    const record = claimed.find((r) => canonicalizeUrl(r.url) === url);
    if (record && record.userId !== userId) {
      throw new ForbiddenError("media_not_owned");
    }
  }

  const keys = storageUrls.map((s) => s.key);
  const pending = await prisma.pendingUpload.findMany({
    where: { key: { in: keys } },
    select: { key: true, userId: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.key, p.userId]));
  // Covers have no media-owner row after their upload claim is consumed.
  // Reuse requires authorship of a channel that already references the URL.
  const urls = storageUrls.map((s) => canonicalizeUrl(s.item.url));
  const coverQuery = {
    where: {
      coverUrl: { in: urls },
      channel: { OR: [
        { ownerId: userId },
        { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } },
      ] },
    },
    select: { coverUrl: true },
    distinct: ["coverUrl" as const],
    take: media.length,
  };
  const [albumCovers, blogCovers] = await Promise.all([
    prisma.album.findMany(coverQuery),
    prisma.blogPost.findMany(coverQuery),
  ]);
  const ownedCovers = new Set([...albumCovers, ...blogCovers]
    .map((cover) => cover.coverUrl).filter((url): url is string => url !== null).map(canonicalizeUrl));
  for (const { item, key } of storageUrls) {
    const url = canonicalizeUrl(item.url);
    if (allowed.has(url)) continue;
    const ownerId = pendingMap.get(key);
    if (ownerId && ownerId !== userId) {
      throw new ForbiddenError("media_not_owned");
    }
    const ownsMedia = claimed.some((r) => canonicalizeUrl(r.url) === url && r.userId === userId);
    if (ownerId !== userId && !ownsMedia && !ownedCovers.has(url)) {
      throw new ForbiddenError("media_not_owned");
    }
  }
}

const MAX_SHORT_ID_ATTEMPTS = 5;

async function assertCanAuthorChannel(channelId: string, userId: string): Promise<void> {
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
}

export async function createAlbum(
  data: CreateAlbumData,
  userId: string,
  requestLanguage?: string,
): Promise<AlbumResponse> {
  const { id, title, description, coverUrl, channelId, media = [], isPublic = true, language = "en" } = data;
  await validateAlbumMediaOwnership(media, userId);
  if (coverUrl) {
    await validateAlbumMediaOwnership([{ url: coverUrl, type: "image" }], userId);
  }

  if (!channelId) throw new ValidationError("channel_required");
  await assertCanAuthorChannel(channelId, userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawAlbum: any;
  for (let attempt = 1; ; attempt++) {
    try {
      rawAlbum = await prisma.album.create({
        data: {
          ...(id ? { id } : {}),
          shortId: generateShortId(),
          slug: derivePostSlug(title, ALBUM_SLUG_MAX_LENGTH) ?? null,
          title,
          description: description || null,
          coverUrl: coverUrl || null,
          isPublic,
          language,
          channelId,
          items: {
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
        include: albumInclude,
      });
      break;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
        const onShortId = Array.isArray(target)
          ? target.includes("shortId")
          : typeof target === "string" && target.includes("shortId");
        if (onShortId && attempt < MAX_SHORT_ID_ATTEMPTS) continue;
        throw new ConflictError(ERROR_ALBUM_ID_COLLISION);
      }
      throw error;
    }
  }

  await deletePendingUploads([...media.map((m) => m.url), ...(coverUrl ? [coverUrl] : [])]);

  return toAlbumResponse(rawAlbum, requestLanguage ?? "en") as AlbumResponse;
}

export async function deleteAlbum(id: string, userId: string): Promise<void> {
  const album = await prisma.album.findUnique({
    where: { id },
    include: { items: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
  });
  if (!album) throw new NotFoundError();
  // 404 (not 403) for strangers: matches posts so delete doesn't oracle
  // private-object existence.
  if (album.channel.ownerId !== userId && !await isChannelEditor(album.channel.id, userId)) {
    throw new NotFoundError();
  }

  const urls = [
    ...album.items.map((m) => canonicalizeUrl(m.url)),
    ...(album.coverUrl ? [canonicalizeUrl(album.coverUrl)] : []),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.album.deleteMany({
      where: {
        id,
        OR: [
          { channel: { ownerId: userId } },
          { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
        ],
      },
    });
  });

  // Delete R2 files only when no album, post, or blog cover references them
  // anymore — the helper runs after commit so it sees the final state.
  if (urls.length > 0) {
    await deleteMediaFiles(await filterOrphanedMediaUrls(urls));
  }
}

export async function updateAlbum(
  id: string,
  userId: string,
  data: UpdateAlbumData,
  requestLanguage?: string,
): Promise<AlbumResponse> {
  const existing = await prisma.album.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      coverUrl: true,
      language: true,
      items: { select: { url: true } },
      channel: { select: { id: true, ownerId: true } },
    },
  });
  if (!existing) throw new NotFoundError();
  if (existing.channel.ownerId !== userId && !await isChannelEditor(existing.channel.id, userId)) {
    throw new NotFoundError();
  }

  const { media, coverUrl, ...rest } = data;
  if (media !== undefined) {
    await validateAlbumMediaOwnership(media, userId, existing.items.map((m) => m.url));
  }
  if (coverUrl) {
    await validateAlbumMediaOwnership(
      [{ url: coverUrl, type: "image" }],
      userId,
      existing.coverUrl ? [existing.coverUrl] : [],
    );
  }

  const albumData: Prisma.AlbumUpdateManyMutationInput = { ...rest };
  if (rest.title !== undefined) {
    albumData.slug = derivePostSlug(rest.title, ALBUM_SLUG_MAX_LENGTH) ?? null;
  }
  if (coverUrl !== undefined) {
    albumData.coverUrl = coverUrl;
  }

  const ownershipFilter: Prisma.AlbumWhereInput = {
    id,
    OR: [
      { channel: { ownerId: userId } },
      { channel: { editors: { some: { userId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
    ],
  };

  // Prove ownership FIRST inside the transaction, then write relations: a
  // role revoked between the pre-fetch above and this write fails closed
  // before any item mutation lands.
  const album = await prisma.$transaction(async (tx) => {
    if (Object.keys(albumData).length > 0) {
      const { count } = await tx.album.updateMany({ where: ownershipFilter, data: albumData });
      if (count === 0) throw new NotFoundError();
    } else {
      const owned = await tx.album.count({ where: ownershipFilter });
      if (owned === 0) throw new NotFoundError();
    }

    if (media !== undefined) {
      await tx.albumItem.deleteMany({ where: { albumId: id } });
      if (media.length > 0) {
        await tx.albumItem.createMany({
          data: media.map((m, i) => ({
            url: m.url,
            type: m.type,
            position: i,
            width: m.width ?? null,
            height: m.height ?? null,
            albumId: id,
            userId,
          })),
        });
      }
    }

    const updated = await tx.album.findUnique({
      where: { id },
      include: albumInclude,
    })!;

    if (updated && !updated.description && updated.items.length === 0) {
      throw new ValidationError("album_must_have_description_or_media");
    }

    return updated;
  });

  if (media !== undefined || coverUrl) {
    await deletePendingUploads([...(media ?? []).map((m) => m.url), ...(coverUrl ? [coverUrl] : [])]);
  }

  // Sweep R2 files the album no longer links: removed items plus a replaced
  // or cleared cover. A file survives when any post, album, or blog cover
  // still references it (filterOrphanedMediaUrls checks every table).
  if (media !== undefined || coverUrl !== undefined) {
    const keptItems = (media ?? existing.items).map((m) => canonicalizeUrl(m.url));
    const keptCover = coverUrl !== undefined ? coverUrl : existing.coverUrl;
    const kept = new Set([
      ...keptItems,
      ...(keptCover ? [canonicalizeUrl(keptCover)] : []),
    ]);
    const previouslyLinked = [
      ...existing.items.map((m) => canonicalizeUrl(m.url)),
      ...(existing.coverUrl ? [canonicalizeUrl(existing.coverUrl)] : []),
    ];
    const removed = previouslyLinked.filter((url) => !kept.has(url));
    const orphaned = await filterOrphanedMediaUrls(removed);
    await deleteMediaFiles(orphaned);
  }

  return toAlbumResponse(album!, requestLanguage ?? "en");
}
