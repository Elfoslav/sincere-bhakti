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
        }
      }
    }
    return toPostChannel(existing);
  }

  const slug = slugifyName(userName);

  // Uniqueness is guaranteed at registration — this is a fallback for
  // legacy users or edge cases. On collision, append a suffix.
  for (let i = 1; i <= 10; i++) {
    const finalSlug = i === 1 ? slug : `${slug}-${i}`;
    const name = i === 1 ? userName : `${userName} (${i})`;

    const slugTaken = await prisma.channel.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    if (slugTaken) continue;

    try {
      const channel = await prisma.channel.create({
        data: { name, normalizedName: normalizeName(name), slug: finalSlug, ownerId: userId, isPersonal: true },
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
  };
}

export async function isChannelEditor(channelId: string, userId: string): Promise<boolean> {
  const editor = await prisma.channelEditor.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  return !!editor;
}
