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

  if (!name || !email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return;

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, name: true, email: true },
  });
  await createPersonalChannel(user.id, user.name);
}
