import { prisma } from "@/lib/prisma";

const memStore = new Map<string, { count: number; resetAt: number }>();

export const RATE_LIMITS = {
  // Registration: 20 attempts per hour per IP
  register: { limit: 20, windowMs: 3_600_000 },
  // Login: 15 attempts per 15 minutes per IP
  login: { limit: 15, windowMs: 900_000 },
  // Post creation: 20 per hour per user
  createPost: { limit: 20, windowMs: 3_600_000 },
  // Post update: 30 per hour per user
  updatePost: { limit: 30, windowMs: 3_600_000 },
  // Post deletion: 30 per hour per user
  deletePost: { limit: 30, windowMs: 3_600_000 },
  // File upload (and cleanup): 60 per hour per user (production only)
  upload: { limit: 60, windowMs: 3_600_000 },
  // Presigned upload URL generation: 20 per hour per user
  uploadUrl: { limit: 20, windowMs: 3_600_000 },
  // Profile update: 10 per hour per user
  updateProfile: { limit: 10, windowMs: 3_600_000 },
  // Read posts: 120 requests per 60s per IP (2 req/s average)
  readPosts: { limit: 120, windowMs: 60_000 },
  // Read channel by slug: 60 requests per 60s per IP
  readChannel: { limit: 60, windowMs: 60_000 },
  // Search channels: 30 requests per 60s per IP
  searchChannels: { limit: 30, windowMs: 60_000 },
  // Channel creation: 10 per hour per user
  createChannel: { limit: 10, windowMs: 3_600_000 },
  // Channel rename: 10 per hour per user
  updateChannel: { limit: 10, windowMs: 3_600_000 },
} as const;

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

  // Single atomic upsert instead of a read-then-write transaction: rate
  // limiting runs on every request, so this halves the DB round trips per
  // request. An expired window resets the counter; otherwise it increments.
  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
    RETURNING "count", "expiresAt"
  `;
  const row = rows[0];

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
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    return dbRateLimit(key, limit, windowMs);
  }

  return memRateLimit(key, limit, windowMs);
}

export function rateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}
