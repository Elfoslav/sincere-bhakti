import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "channel";
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const existing = await prisma.channel.findUnique({ where: { slug: base } });
  if (!existing) return base;

  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    const taken = await prisma.channel.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function main() {
  console.log("=== Channels Migration ===");

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  console.log(`Found ${users.length} users`);

  let channelsCreated = 0;
  let postsUpdated = 0;

  for (const user of users) {
    const existingChannel = await prisma.channel.findFirst({ where: { ownerId: user.id } });
    if (existingChannel) {
      console.log(`  User ${user.name} already has channel "${existingChannel.name}"`);
      continue;
    }

    const slug = await ensureUniqueSlug(slugify(user.name));
    const channel = await prisma.channel.create({
      data: {
        name: user.name,
        slug,
        ownerId: user.id,
      },
    });
    channelsCreated++;
    console.log(`  Created channel "${channel.name}" (/${channel.slug}) for user ${user.name}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma.post.updateMany as any)({
      where: { authorId: user.id },
      data: { channelId: channel.id },
    });
    postsUpdated += result.count;
  }

  console.log(`\nDone: ${channelsCreated} channels created, ${postsUpdated} posts updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
