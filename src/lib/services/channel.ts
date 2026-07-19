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
import type { ChannelMember, ChannelSettings } from "@/types/channel";

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
      if (!isPrismaTransactionConflict(error) || attempt === CHANNEL_MEMBER_TRANSACTION_MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("unreachable_transaction_retry_state");
}

function toPostChannel(channel: { id: string; name: string; slug: string; avatarUrl: string | null; ownerId: string }): PostChannel {
  return {
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    avatarUrl: channel.avatarUrl,
    ownerId: channel.ownerId,
  };
}

export async function createPersonalChannel(userId: string, userName: string): Promise<PostChannel> {
  const existing = await prisma.channel.findFirst({ where: { ownerId: userId, isPersonal: true } });
  if (existing) {
    // Update legacy bootstrap slug (e.g. "user-cuid") to proper name-based slug.
    if (existing.slug.startsWith("user-")) {
      const properSlug = slugifyName(userName);
      for (let i = 1; i <= 10; i++) {
        const finalSlug = i === 1 ? properSlug : `${properSlug}-${i}`;
        try {
          await prisma.channel.update({
            where: { id: existing.id },
            data: { slug: finalSlug, name: userName, normalizedName: normalizeName(userName) },
          });
          return toPostChannel({ ...existing, slug: finalSlug, name: userName });
        } catch (err) {
          if ((err as { code?: string })?.code !== "P2002") throw err;
          console.warn(
            `[createPersonalChannel] fixup P2002: userId=${userId} userName="${userName}" ` +
            `properSlug="${properSlug}" attempt=${i} finalSlug="${finalSlug}" ` +
            `oldSlug="${existing.slug}"`
          );
        }
      }
      console.warn(
        `[createPersonalChannel] fixup exhausted 10 attempts for userId=${userId} ` +
        `userName="${userName}" properSlug="${properSlug}" oldSlug="${existing.slug}" — using UUID fallback`
      );
      // Last resort: random suffix guarantees the slug is never left as "user-".
      const uuid = crypto.randomUUID().slice(0, 8);
      await prisma.channel.update({
        where: { id: existing.id },
        data: { slug: `${properSlug}-${uuid}`, name: userName, normalizedName: normalizeName(userName) },
      });
      return toPostChannel({ ...existing, slug: `${properSlug}-${uuid}`, name: userName });
    }
    return toPostChannel(existing);
  }
  console.warn(
    `[createPersonalChannel] no existing personal channel for userId=${userId} userName="${userName}" — creating new`
  );

  const slug = slugifyName(userName);

  // Uniqueness is guaranteed at registration — this is a fallback for
  // legacy users or edge cases. On collision, append a suffix.
  for (let i = 1; i <= 10; i++) {
    const finalSlug = i === 1 ? slug : `${slug}-${i}`;
    const name = i === 1 ? userName : `${userName} (${i})`;
    const normalized = normalizeName(name);

    const slugTaken = await prisma.channel.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    if (slugTaken) continue;

    const slugInHistory = await prisma.channelSlugHistory.findFirst({ where: { oldSlug: finalSlug }, select: { id: true } });
    if (slugInHistory) continue;

    const nameInHistory = await prisma.channelSlugHistory.findFirst({ where: { oldNormalizedName: normalized }, select: { id: true } });
    if (nameInHistory) continue;

    try {
      const channel = await prisma.channel.create({
        data: { name, normalizedName: normalized, slug: finalSlug, ownerId: userId, isPersonal: true },
      });
      return toPostChannel(channel);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  const channel = await prisma.channel.create({
    data: { name: `${userName} (${uuid})`, normalizedName: normalizeName(`${userName} (${uuid})`), slug: `${slug}-${uuid}`, ownerId: userId, isPersonal: true },
  });
  return toPostChannel(channel);
}

export async function getPersonalChannel(userId: string): Promise<PostChannel | null> {
  const channel = await prisma.channel.findFirst({
    where: { ownerId: userId, isPersonal: true },
  });
  if (!channel) return null;
  return toPostChannel(channel);
}

export async function getChannelBySlug(slug: string): Promise<{
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
  const channel = await prisma.channel.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { posts: { where: { isPublic: true } } } },
    },
  });
  if (!channel) return null;
    return {
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
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
  const existing = await prisma.channel.findFirst({
    where: { normalizedName, id: excludeChannelId ? { not: excludeChannelId } : undefined },
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
export async function resolveSlugRedirect(oldSlug: string): Promise<string | null> {
  const entry = await prisma.channelSlugHistory.findUnique({
    where: { oldSlug },
    include: { channel: { select: { slug: true } } },
  });
  return entry?.channel.slug ?? null;
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

export async function getChannelSettingsBySlug(slug: string, userId: string): Promise<ChannelSettings | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!channel) return null;

  if (!await canManageChannelSettings(channel.id, userId)) return null;

  return {
    channel: {
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      avatarUrl: channel.avatarUrl,
      ownerId: channel.ownerId,
      ownerName: channel.owner.name,
      ownerEmail: channel.owner.email,
    },
    members: await getChannelMembers(channel.id),
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

export async function getAuthorableChannels(userId: string): Promise<AuthorableIdentity[]> {
  const [owned, editable] = await Promise.all([
    prisma.channel.findMany({
      where: { ownerId: userId },
      orderBy: [{ isPersonal: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true, isPersonal: true },
    }),
    prisma.channelEditor.findMany({
      where: { userId },
      include: {
        channel: {
          select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true, isPersonal: true },
        },
      },
      orderBy: [{ channelId: "asc" }],
    }),
  ]);

  const identities = new Map<string, AuthorableIdentity>();
  for (const channel of owned) {
    identities.set(channel.id, { ...channel, role: CHANNEL_ROLE_OWNER });
  }
  for (const editor of editable) {
    if (!identities.has(editor.channel.id)) {
      identities.set(editor.channel.id, { ...editor.channel, role: editor.role as ChannelRole });
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

export async function createChannel(userId: string, channelName: string): Promise<PostChannel & { postCount: number }> {
  const slug = slugifyName(channelName);
  const normalized = normalizeName(channelName);
  const maxChannelsPerUser = getMaxChannelsPerUser();

  const maxTransactionRetries = 3;

  for (let attempt = 1; attempt <= maxTransactionRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Lock the owning user row so concurrent creates for the same account
        // serialize before we count and insert.
        await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;

        const additionalChannelCount = await tx.channel.count({
          where: { ownerId: userId, isPersonal: false },
        });
        if (additionalChannelCount >= maxChannelsPerUser) {
          throw new ChannelLimitError();
        }

        // Fail if an active channel already has this name
        const nameTaken = await tx.channel.findFirst({
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

          const slugTaken = await tx.channel.findFirst({
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
            data: { name, normalizedName: normalizeName(name), slug: finalSlug, ownerId: userId, isPersonal: false },
          });
          return { ...toPostChannel(channel), postCount: 0 };
        }

        const uuid = crypto.randomUUID().slice(0, 8);
        const channel = await tx.channel.create({
          data: { name: `${channelName} (${uuid})`, normalizedName: normalizeName(`${channelName} (${uuid})`), slug: `${slug}-${uuid}`, ownerId: userId, isPersonal: false },
        });
        return { ...toPostChannel(channel), postCount: 0 };
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
