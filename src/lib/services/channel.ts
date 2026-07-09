import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";
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

function slugify(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "channel";
}

export async function createPersonalChannel(userId: string, userName: string): Promise<PostChannel> {
  // Check if channel already exists (handles concurrent JWT callbacks)
  const existing = await prisma.channel.findFirst({ where: { ownerId: userId } });
  if (existing) return toPostChannel(existing);

  // Fetch all existing names (normalized) for fuzzy-duplicate detection.
  // "Taruṇa" and "Taruna" should be treated as the same name.
  const allChannels = await prisma.channel.findMany({ select: { name: true } });
  const existingNames = new Set(allChannels.map((c) => normalizeName(c.name)));

  const baseSlug = slugify(userName);

  for (let i = 1; i <= 1000; i++) {
    const name = i === 1 ? userName : `${userName} (${i})`;
    const slug = i === 1 ? baseSlug : `${baseSlug}-${i}`;

    // Skip if normalized name is taken (handles diacritic variants)
    if (existingNames.has(normalizeName(name))) continue;

    // Fast check — skip if slug is already taken
    const slugTaken = await prisma.channel.findFirst({ where: { slug }, select: { id: true } });
    if (slugTaken) continue;

    try {
      // Race: another request may have sniped name/slug between check and create
      const channel = await prisma.channel.create({
        data: { name, slug, ownerId: userId },
      });
      existingNames.add(normalizeName(name)); // prevent sibling loops from reusing
      return toPostChannel(channel);
    } catch (err) {
      // P2002 = unique constraint violation — concurrent request took it
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }

  // Extremely unlikely fallback — random UUID suffix
  const uuid = crypto.randomUUID().slice(0, 8);
  const channel = await prisma.channel.create({
    data: { name: `${userName} (${uuid})`, slug: `${baseSlug}-${uuid}`, ownerId: userId },
  });
  return toPostChannel(channel);
}

export async function getPersonalChannel(userId: string): Promise<PostChannel | null> {
  const channel = await prisma.channel.findFirst({
    where: { ownerId: userId },
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
} | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { posts: true } },
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
  };
}

export async function isChannelEditor(channelId: string, userId: string): Promise<boolean> {
  const editor = await prisma.channelEditor.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  return !!editor;
}
