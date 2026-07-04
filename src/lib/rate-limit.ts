import { prisma } from "@/lib/prisma";

const memStore = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function memCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key);
  }
}

function memRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetIn: number } {
  memCleanup();
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now };
}

async function dbRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.expiresAt <= now) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { count: 1, expiresAt };
    }

    if (existing.count >= limit) {
      return existing;
    }

    const updated = await tx.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return updated;
  });

  const allowed = row.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - row.count),
    resetIn: row.expiresAt.getTime() - now.getTime(),
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (process.env.NODE_ENV === "production") {
    return dbRateLimit(key, limit, windowMs);
  }

  return memRateLimit(key, limit, windowMs);
}

export function rateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}
