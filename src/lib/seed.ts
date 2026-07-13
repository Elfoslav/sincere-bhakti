import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { BCRYPT_SALT_ROUNDS } from "./validation";
import { createPersonalChannel } from "./services/channel";

const globalForSeed = globalThis as unknown as { seeded?: boolean };

export async function ensureDefaultUser(): Promise<void> {
  if (globalForSeed.seeded) return;
  globalForSeed.seeded = true;

  const name = process.env.SINCERE_BHAKTI_NAME;
  const email = process.env.SINCERE_BHAKTI_EMAIL;
  const password = process.env.SINCERE_BHAKTI_PASSWORD;

  if (!name || !email || !password) {
    console.log("[seed] SKIP: missing SINCERE_BHAKTI_* env vars");
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true },
    });

    if (existing) {
      const channel = await prisma.channel.findFirst({
        where: { ownerId: existing.id, isPersonal: true },
        select: { id: true },
      });
      if (!channel) {
        console.log(`[seed] user "${existing.name}" exists but has no personal channel — creating one`);
        await createPersonalChannel(existing.id, existing.name);
      }
      globalForSeed.seeded = true;
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, password: hashedPassword },
      select: { id: true, name: true, email: true },
    });
    await createPersonalChannel(user.id, user.name);
    console.log(`[seed] created user "${name}" with personal channel`);
    globalForSeed.seeded = true;
  } catch (e) {
    console.error("[seed] failed:", e);
    // Allow retry on next call (transient DB failure should not permanently suppress seeding).
    globalForSeed.seeded = false;
  }
}
