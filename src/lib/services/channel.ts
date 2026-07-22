import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugifyName, normalizeName } from "@/lib/validation";
import { getMaxChannelsPerUser } from "@/lib/channel-limit";
import {
  CHANNEL_AUTHOR_ROLES,
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_OWNER,
  type ChannelMemberRole,
  type ChannelRole,
} from "@/lib/channel-roles";
import type { PostChannel } from "@/types/post";
import type { AuthorableIdentity } from "@/types/identity";
import type { ChannelMember, ChannelSettings, ChannelSettingsTranslation } from "@/types/channel";

import { resolveTranslation, type TranslationInfo } from "@/lib/channel-translation";
import { logServerError } from "@/lib/server-log";

export class NotFoundError extends Error {
  name = "NotFoundError" as const;
}
export class NameTakenError extends Error {
  name = "NameTakenError" as const;
}
export class ChannelLimitError extends Error {
  name = "ChannelLimitError" as const;
}
export class UserNotFoundError extends Error {
  name = "UserNotFoundError" as const;
}
export class CannotAddChannelOwnerError extends Error {
  name = "CannotAddChannelOwnerError" as const;
}
export class ChannelMemberAlreadyExistsError extends Error {
  name = "ChannelMemberAlreadyExistsError" as const;
}
export class ChannelMemberTransactionConflictError extends Error {
  name = "ChannelMemberTransactionConflictError" as const;
}

const CHANNEL_MEMBER_TRANSACTION_MAX_ATTEMPTS = 3;
const PRISMA_TRANSACTION_CONFLICT_CODE = "P2034";

function isPrismaTransactionConflict(error: unknown): boolean {
  return (error as { code?: string })?.code === PRISMA_TRANSACTION_CONFLICT_CODE;
}

async function runChannelMemberTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= CHANNEL_MEMBER_TRANSACTION_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isPrismaTransactionConflict(error)) {
        throw error;
      }
      if (attempt === CHANNEL_MEMBER_TRANSACTION_MAX_ATTEMPTS) {
        throw new ChannelMemberTransactionConflictError();
      }
    }
  }

  throw new Error("unreachable_transaction_retry_state");
}

function toPostChannel(
  channel: { id: string; avatarUrl: string | null; ownerId: string },
  translations: TranslationInfo[],
  language: string,
): PostChannel {
  const t = resolveTranslation(translations, language);
  return {
    id: channel.id,
    name: t?.name ?? "",
    slug: t?.slug ?? "",
    avatarUrl: channel.avatarUrl,
    ownerId: channel.ownerId,
  };
}

export async function createPersonalChannel(
  userId: string,
  userName: string,
  language: string = "en",
): Promise<PostChannel> {
  const existing = await prisma.channel.findFirst({
    where: { ownerId: userId, isPersonal: true },
    include: { translations: { select: { language: true, name: true, slug: true } } },
  });

  if (existing) {
    // Edge case: channel exists but has zero translations (dev/test gap).
    // Create the default-language translation rather than returning empty strings.
    if (existing.translations.length === 0) {
      const slug = slugifyName(userName);
      const t = await prisma.channelTranslation.create({
        data: { channelId: existing.id, language, name: userName, normalizedName: normalizeName(userName), slug },
      });
      return toPostChannel(existing, [t], language);
    }

    const translation = resolveTranslation(existing.translations, language);
    const currentSlug = translation?.slug ?? "";

    // Update legacy bootstrap slug (e.g. "user-cuid") to proper name-based slug.
    if (currentSlug.startsWith("user-")) {
      const properSlug = slugifyName(userName);
      for (let i = 1; i <= 10; i++) {
        const finalSlug = i === 1 ? properSlug : `${properSlug}-${i}`;
        try {
          const slugTaken = await prisma.channelTranslation.findUnique({ where: { slug: finalSlug } });
          if (slugTaken) continue;

          await prisma.channelTranslation.upsert({
            where: { channelId_language: { channelId: existing.id, language } },
            create: { channelId: existing.id, language, name: userName, normalizedName: normalizeName(userName), slug: finalSlug },
            update: { name: userName, normalizedName: normalizeName(userName), slug: finalSlug },
          });
          return toPostChannel(existing, [{ language, name: userName, slug: finalSlug }], language);
        } catch (err) {
          if ((err as { code?: string })?.code !== "P2002") throw err;
          logServerError(
            `[createPersonalChannel] fixup P2002: userId=${userId} userName="${userName}" ` +
            `properSlug="${properSlug}" attempt=${i} finalSlug="${finalSlug}" ` +
            `oldSlug="${currentSlug}"`,
            err,
          );
        }
      }
      logServerError(
        `[createPersonalChannel] fixup exhausted 10 attempts for userId=${userId} ` +
        `userName="${userName}" properSlug="${properSlug}" oldSlug="${currentSlug}" — using UUID fallback`,
        new Error("fixup_retries_exhausted"),
      );
      const uuid = crypto.randomUUID().slice(0, 8);
      await prisma.channelTranslation.upsert({
        where: { channelId_language: { channelId: existing.id, language } },
        create: { channelId: existing.id, language, name: userName, normalizedName: normalizeName(userName), slug: `${properSlug}-${uuid}` },
        update: { name: userName, normalizedName: normalizeName(userName), slug: `${properSlug}-${uuid}` },
      });
      return toPostChannel(existing, [{ language, name: userName, slug: `${properSlug}-${uuid}` }], language);
    }

    return toPostChannel(existing, existing.translations, language);
  }

  logServerError(
    `[createPersonalChannel] no existing personal channel for userId=${userId} userName="${userName}" — creating new`,
    new Error("missing_personal_channel"),
  );

  const slug = slugifyName(userName);

  for (let i = 1; i <= 10; i++) {
    const finalSlug = i === 1 ? slug : `${slug}-${i}`;
    const name = i === 1 ? userName : `${userName} (${i})`;
    const normalized = normalizeName(name);

    const slugTaken = await prisma.channelTranslation.findUnique({ where: { slug: finalSlug } });
    if (slugTaken) continue;

    const slugInHistory = await prisma.channelSlugHistory.findFirst({ where: { oldSlug: finalSlug }, select: { id: true } });
    if (slugInHistory) continue;

    const nameInHistory = await prisma.channelSlugHistory.findFirst({ where: { oldNormalizedName: normalized }, select: { id: true } });
    if (nameInHistory) continue;

    try {
      const channel = await prisma.channel.create({
        data: {
          ownerId: userId,
          isPersonal: true,
          translations: {
            create: { language, name, normalizedName: normalized, slug: finalSlug },
          },
        },
      });
      return toPostChannel(channel, [{ language, name, slug: finalSlug }], language);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  const channel = await prisma.channel.create({
    data: {
      ownerId: userId,
      isPersonal: true,
      translations: {
        create: { language, name: `${userName} (${uuid})`, normalizedName: normalizeName(`${userName} (${uuid})`), slug: `${slug}-${uuid}` },
      },
    },
  });
  return toPostChannel(channel, [{ language, name: `${userName} (${uuid})`, slug: `${slug}-${uuid}` }], language);
}

export async function getPersonalChannel(userId: string, language: string = "en"): Promise<PostChannel | null> {
  const channel = await prisma.channel.findFirst({
    where: { ownerId: userId, isPersonal: true },
    include: { translations: { select: { language: true, name: true, slug: true } } },
  });
  if (!channel) return null;
  return toPostChannel(channel, channel.translations, language);
}

export async function getChannelBySlug(slug: string, language: string = "en"): Promise<{
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
  ownerImage: string | null;
  postCount: number;
  isPersonal: boolean;
  renameCount: number;
} | null> {
  const translation = await prisma.channelTranslation.findUnique({
    where: { slug },
    select: { id: true, channelId: true, language: true, name: true, slug: true },
  });
  if (!translation) return null;

  const channel = await prisma.channel.findUnique({
    where: { id: translation.channelId },
    select: {
      id: true,
      avatarUrl: true,
      createdAt: true,
      ownerId: true,
      isPersonal: true,
      renameCount: true,
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { posts: { where: { isPublic: true } } } },
    },
  });
  if (!channel) return null;

  if (translation.language === language) {
    return {
      id: channel.id,
      name: translation.name,
      slug: translation.slug,
      avatarUrl: channel.avatarUrl,
      createdAt: channel.createdAt,
      ownerId: channel.ownerId,
      ownerName: channel.owner.name,
      ownerImage: channel.owner.image,
      postCount: channel._count.posts,
      isPersonal: channel.isPersonal,
      renameCount: channel.renameCount,
    };
  }

  const allTranslations = await prisma.channelTranslation.findMany({
    where: { channelId: channel.id },
    select: { language: true, name: true, slug: true },
  });
  const resolved = resolveTranslation(allTranslations, language) ?? translation;
  return {
    id: channel.id,
    name: resolved.name,
    slug: resolved.slug,
    avatarUrl: channel.avatarUrl,
    createdAt: channel.createdAt,
    ownerId: channel.ownerId,
    ownerName: channel.owner.name,
    ownerImage: channel.owner.image,
    postCount: channel._count.posts,
    isPersonal: channel.isPersonal,
    renameCount: channel.renameCount,
  };
}

// `generateMetadata` and the page body both need channel data. React's
// cache ensures only one Prisma query within the same request.
export const getCachedChannelBySlug = cache(getChannelBySlug);

// Check if a normalizedName is taken by any active channel or slug history,
// optionally excluding a specific channel (e.g. the one being renamed).
export async function isNormalizedNameTaken(
  normalizedName: string,
  excludeChannelId?: string,
): Promise<boolean> {
  const existing = await prisma.channelTranslation.findFirst({
    where: { normalizedName, channelId: excludeChannelId ? { not: excludeChannelId } : undefined },
    select: { id: true },
  });
  if (existing) return true;

  const historical = await prisma.channelSlugHistory.findFirst({
    where: { oldNormalizedName: normalizedName, channelId: excludeChannelId ? { not: excludeChannelId } : undefined },
    select: { id: true },
  });
  return !!historical;
}

// Resolve an old slug to the channel's current slug, or return null.
export async function resolveSlugRedirect(oldSlug: string, language?: string): Promise<string | null> {
  const entry = await prisma.channelSlugHistory.findUnique({
    where: { oldSlug },
    include: { channel: { include: { translations: { select: { language: true, slug: true } } } } },
  });
  if (!entry) return null;
  const translations = entry.channel.translations;
  if (language) {
    const t = translations.find((tr) => tr.language === language);
    if (t) return t.slug;
  }
  return translations[0]?.slug ?? null;
}

export async function isChannelEditor(channelId: string, userId: string): Promise<boolean> {
  const editor = await prisma.channelEditor.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { role: true },
  });
  return !!editor && (CHANNEL_AUTHOR_ROLES as readonly string[]).includes(editor.role);
}

export async function canManageChannelSettings(channelId: string, userId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { ownerId: true },
  });
  if (!channel) return false;
  if (channel.ownerId === userId) return true;

  const editor = await prisma.channelEditor.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { role: true },
  });
  return editor?.role === CHANNEL_ROLE_ADMIN;
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const members = await prisma.channelEditor.findMany({
    where: { channelId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [{ role: "asc" }, { userId: "asc" }],
  });

  return members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    image: member.user.image,
    role: member.role as ChannelMemberRole,
  }));
}

export async function getChannelSettingsBySlug(
  slug: string,
  userId: string,
  language: string = "en",
): Promise<ChannelSettings | null> {
  const translation = await prisma.channelTranslation.findUnique({
    where: { slug },
    select: { id: true, channelId: true, language: true, name: true, slug: true },
  });
  if (!translation) return null;

  const channel = await prisma.channel.findUnique({
    where: { id: translation.channelId },
    select: {
      id: true,
      avatarUrl: true,
      ownerId: true,
      isPersonal: true,
      renameCount: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!channel) return null;

  if (!await canManageChannelSettings(channel.id, userId)) return null;

  const allTranslations = await prisma.channelTranslation.findMany({
    where: { channelId: channel.id },
    select: { id: true, language: true, name: true, slug: true },
  });

  const resolved = resolveTranslation(allTranslations, language) ?? translation;
  return {
    channel: {
      id: channel.id,
      name: resolved.name,
      slug: resolved.slug,
      avatarUrl: channel.avatarUrl,
      ownerId: channel.ownerId,
      ownerName: channel.owner.name,
      ownerEmail: channel.owner.email,
      isPersonal: channel.isPersonal,
      renameCount: channel.renameCount,
    },
    members: await getChannelMembers(channel.id),
    translations: allTranslations as ChannelSettingsTranslation[],
  };
}

async function getManageableChannelForMemberMutation(
  tx: Prisma.TransactionClient,
  channelId: string,
  actorUserId: string,
) {
  const channel = await tx.channel.findUnique({
    where: { id: channelId },
    select: { ownerId: true },
  });
  if (!channel) throw new NotFoundError();

  if (channel.ownerId !== actorUserId) {
    const actorMember = await tx.channelEditor.findUnique({
      where: { channelId_userId: { channelId, userId: actorUserId } },
      select: { role: true },
    });
    if (actorMember?.role !== CHANNEL_ROLE_ADMIN) {
      throw new NotFoundError();
    }
  }

  return channel;
}

export async function addChannelMemberByEmail({
  channelId,
  email,
  role,
  actorUserId,
}: {
  channelId: string;
  email: string;
  role: ChannelMemberRole;
  actorUserId: string;
}): Promise<ChannelMember> {
  return runChannelMemberTransaction(async (tx) => {
    const channel = await getManageableChannelForMemberMutation(tx, channelId, actorUserId);

    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!user) throw new UserNotFoundError();
    if (user.id === channel.ownerId) throw new CannotAddChannelOwnerError();

    const existingMember = await tx.channelEditor.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
      select: { userId: true },
    });
    if (existingMember) throw new ChannelMemberAlreadyExistsError();

    const member = await tx.channelEditor.create({
      data: { channelId, userId: user.id, role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.role as ChannelMemberRole,
    };
  });
}

export async function updateChannelMemberByEmail({
  channelId,
  email,
  role,
  actorUserId,
}: {
  channelId: string;
  email: string;
  role: ChannelMemberRole;
  actorUserId: string;
}): Promise<ChannelMember> {
  return runChannelMemberTransaction(async (tx) => {
    const channel = await getManageableChannelForMemberMutation(tx, channelId, actorUserId);

    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!user) throw new UserNotFoundError();
    if (user.id === channel.ownerId) throw new CannotAddChannelOwnerError();

    try {
      const member = await tx.channelEditor.update({
        where: { channelId_userId: { channelId, userId: user.id } },
        data: { role },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      return {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
        role: member.role as ChannelMemberRole,
      };
    } catch (error) {
      if ((error as { code?: string })?.code === "P2025") throw new NotFoundError();
      throw error;
    }
  });
}

export async function getAuthorableChannels(userId: string, language: string = "en"): Promise<AuthorableIdentity[]> {
  const [owned, editable] = await Promise.all([
    prisma.channel.findMany({
      where: { ownerId: userId },
      orderBy: [{ isPersonal: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      include: { translations: { select: { language: true, name: true, slug: true } } },
    }),
    prisma.channelEditor.findMany({
      where: { userId },
      include: {
        channel: {
          include: { translations: { select: { language: true, name: true, slug: true } } },
        },
      },
      orderBy: [{ channelId: "asc" }],
    }),
  ]);

  const identities = new Map<string, AuthorableIdentity>();
  for (const channel of owned) {
    const resolved = resolveTranslation(channel.translations, language);
    identities.set(channel.id, {
      id: channel.id,
      name: resolved?.name ?? "",
      slug: resolved?.slug ?? "",
      avatarUrl: channel.avatarUrl,
      ownerId: channel.ownerId,
      isPersonal: channel.isPersonal,
      role: CHANNEL_ROLE_OWNER,
    });
  }
  for (const editor of editable) {
    if (!identities.has(editor.channel.id)) {
      const resolved = resolveTranslation(editor.channel.translations, language);
      identities.set(editor.channel.id, {
        id: editor.channel.id,
        name: resolved?.name ?? "",
        slug: resolved?.slug ?? "",
        avatarUrl: editor.channel.avatarUrl,
        ownerId: editor.channel.ownerId,
        isPersonal: editor.channel.isPersonal,
        role: editor.role as ChannelRole,
      });
    }
  }

  return Array.from(identities.values());
}

export async function canAuthorChannel(channelId: string, userId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { ownerId: true },
  });
  if (!channel) return false;
  if (channel.ownerId === userId) return true;
  return isChannelEditor(channelId, userId);
}

export async function resolveAuthorableChannelId({
  explicitChannelId,
  preferredChannelId,
  fallbackChannelId,
  userId,
}: {
  explicitChannelId?: string;
  preferredChannelId?: string;
  fallbackChannelId?: string;
  userId: string;
}): Promise<{ channelId?: string; shouldRefreshPreference: boolean; explicitForbidden: boolean }> {
  if (explicitChannelId) {
    const allowed = await canAuthorChannel(explicitChannelId, userId);
    return {
      channelId: allowed ? explicitChannelId : undefined,
      shouldRefreshPreference: false,
      explicitForbidden: !allowed,
    };
  }

  if (preferredChannelId && await canAuthorChannel(preferredChannelId, userId)) {
    return {
      channelId: preferredChannelId,
      shouldRefreshPreference: false,
      explicitForbidden: false,
    };
  }

  if (fallbackChannelId && await canAuthorChannel(fallbackChannelId, userId)) {
    return {
      channelId: fallbackChannelId,
      shouldRefreshPreference: preferredChannelId !== undefined && preferredChannelId !== fallbackChannelId,
      explicitForbidden: false,
    };
  }

  return {
    channelId: undefined,
    shouldRefreshPreference: preferredChannelId !== undefined,
    explicitForbidden: false,
  };
}

export async function createChannel(
  userId: string,
  channelName: string,
  language: string = "en",
): Promise<PostChannel & { postCount: number }> {
  const slug = slugifyName(channelName);
  const normalized = normalizeName(channelName);
  const maxChannelsPerUser = getMaxChannelsPerUser();

  const maxTransactionRetries = 3;

  for (let attempt = 1; attempt <= maxTransactionRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;

        const additionalChannelCount = await tx.channel.count({
          where: { ownerId: userId, isPersonal: false },
        });
        if (additionalChannelCount >= maxChannelsPerUser) {
          throw new ChannelLimitError();
        }

        // Fail if a translation already has this name
        const nameTaken = await tx.channelTranslation.findFirst({
          where: { normalizedName: normalized },
          select: { id: true },
        });
        if (nameTaken) throw new NameTakenError();

        const historyNameTaken = await tx.channelSlugHistory.findFirst({
          where: { oldNormalizedName: normalized },
          select: { id: true },
        });
        if (historyNameTaken) throw new NameTakenError();

        for (let i = 1; i <= 10; i++) {
          const finalSlug = i === 1 ? slug : `${slug}-${i}`;
          const name = i === 1 ? channelName : `${channelName} (${i})`;

          const slugTaken = await tx.channelTranslation.findUnique({
            where: { slug: finalSlug },
            select: { id: true },
          });
          if (slugTaken) continue;

          const historySlugTaken = await tx.channelSlugHistory.findFirst({
            where: { oldSlug: finalSlug },
            select: { id: true },
          });
          if (historySlugTaken) continue;

          const channel = await tx.channel.create({
            data: {
              ownerId: userId,
              isPersonal: false,
              translations: {
                create: { language, name, normalizedName: normalizeName(name), slug: finalSlug },
              },
            },
          });
          return { ...toPostChannel(channel, [{ language, name, slug: finalSlug }], language), postCount: 0 };
        }

        const uuid = crypto.randomUUID().slice(0, 8);
        const channel = await tx.channel.create({
          data: {
            ownerId: userId,
            isPersonal: false,
            translations: {
              create: { language, name: `${channelName} (${uuid})`, normalizedName: normalizeName(`${channelName} (${uuid})`), slug: `${slug}-${uuid}` },
            },
          },
        });
        return { ...toPostChannel(channel, [{ language, name: `${channelName} (${uuid})`, slug: `${slug}-${uuid}` }], language), postCount: 0 };
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002" && attempt < maxTransactionRetries) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("unreachable");
}
