import { prisma } from "@/lib/prisma";
import { slugifyName, normalizeName } from "@/lib/validation";
import type { PostChannel } from "@/types/post";

export class NotFoundError extends Error {
  name = "NotFoundError" as const;
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
  };
}

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
  });
  return !!editor;
}

export async function createChannel(userId: string, channelName: string): Promise<PostChannel & { postCount: number }> {
  const slug = slugifyName(channelName);

  for (let i = 1; i <= 10; i++) {
    const finalSlug = i === 1 ? slug : `${slug}-${i}`;
    const name = i === 1 ? channelName : `${channelName} (${i})`;
    const normalized = normalizeName(name);

    const existing = await prisma.channel.findFirst({
      where: { OR: [{ slug: finalSlug }, { normalizedName: normalized }] },
      select: { id: true },
    });
    if (existing) continue;

    const historyNameTaken = await prisma.channelSlugHistory.findFirst({
      where: { oldNormalizedName: normalized },
      select: { id: true },
    });
    if (historyNameTaken) continue;

    const historySlugTaken = await prisma.channelSlugHistory.findFirst({
      where: { oldSlug: finalSlug },
      select: { id: true },
    });
    if (historySlugTaken) continue;

    try {
      const channel = await prisma.channel.create({
        data: { name, normalizedName: normalized, slug: finalSlug, ownerId: userId, isPersonal: false },
      });
      return { ...toPostChannel(channel), postCount: 0 };
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  const channel = await prisma.channel.create({
    data: { name: `${channelName} (${uuid})`, normalizedName: normalizeName(`${channelName} (${uuid})`), slug: `${slug}-${uuid}`, ownerId: userId, isPersonal: false },
  });
  return { ...toPostChannel(channel), postCount: 0 };
}

const globalForBackfill = globalThis as unknown as { legacySlugsFixed?: boolean };

// Backfill legacy "user-<cuid>" personal-channel slugs on deploy so every
// existing user gets a proper name-based slug immediately, not just on
// next login. Idempotent — safe to run on every server start.
export async function fixLegacyPersonalChannelSlugs(): Promise<void> {
  if (globalForBackfill.legacySlugsFixed) return;
  globalForBackfill.legacySlugsFixed = true;

  const legacy = await prisma.channel.findMany({
    where: { isPersonal: true, slug: { startsWith: "user-" } },
    include: { owner: { select: { name: true } } },
  });

  if (legacy.length === 0) return;
  console.log(`[fixLegacySlugs] found ${legacy.length} channels with legacy slugs`);

  for (const channel of legacy) {
    const userName = channel.owner.name || channel.name;
    const properSlug = slugifyName(userName);
    let fixed = false;

    for (let i = 1; i <= 10; i++) {
      const finalSlug = i === 1 ? properSlug : `${properSlug}-${i}`;
      try {
        // Only update name if it won't collide with another channel's unique name.
        const nameTaken = await prisma.channel.findFirst({
          where: { name: userName, id: { not: channel.id } },
          select: { id: true },
        });

        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            slug: finalSlug,
            normalizedName: normalizeName(userName),
            ...(!nameTaken && channel.name !== userName ? { name: userName } : {}),
          },
        });
        console.log(`[fixLegacySlugs] fixed channel ${channel.id}: ${channel.slug} → ${finalSlug}`);
        fixed = true;
        break;
      } catch (err) {
        if ((err as { code?: string })?.code !== "P2002") throw err;
      }
    }

    if (!fixed) {
      const uuid = crypto.randomUUID().slice(0, 8);
      await prisma.channel.update({
        where: { id: channel.id },
        data: { slug: `${properSlug}-${uuid}`, normalizedName: normalizeName(userName) },
      });
      console.log(`[fixLegacySlugs] fallback ${channel.id}: ${channel.slug} → ${properSlug}-${uuid}`);
    }
  }
}
