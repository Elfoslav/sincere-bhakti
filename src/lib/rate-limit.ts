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
  // Read single post by id: 120 requests per 60s per IP
  readPostDetail: { limit: 120, windowMs: 60_000 },
  // Read user profile: 60 requests per 60s per IP
  readProfile: { limit: 60, windowMs: 60_000 },
  // Password change: 5 per hour per user
  changePassword: { limit: 5, windowMs: 3_600_000 },
} as const;

// Rate-limit key prefixes — shared across API routes and SSR pages so every
// caller uses the same string.  These double as the `route` value in the
// rate_limited warning log.
export const RATE_LIMIT_PREFIX = {
  register: "register",
  login: "login",
  readPosts: "read-posts",
  createPost: "create-post",
  updatePost: "update-post",
  deletePost: "delete-post",
  upload: "upload",
  uploadUrl: "upload-url",
  updateProfile: "update-profile",
  readChannel: "read-channel",
  searchChannels: "search-channels",
  createChannel: "create-channel",
  updateChannel: "update-channel",
  readPostDetail: "read-post-detail",
  readProfile: "read-profile",
  changePassword: "change-password",
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

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }
  entry.count++;

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
  // Once the limit is exceeded, the WHERE clause prevents further writes
  // (the row is read-only until the window expires), keeping hot keys from
  // repeatedly locking and rewriting the same row under abusive traffic.
  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
    WHERE "RateLimit"."expiresAt" <= ${now} OR "RateLimit"."count" < ${limit}
    RETURNING "count", "expiresAt"
  `;
  const row = rows[0];

  // No row returned: the WHERE clause filtered the update out, meaning the
  // key exists, its window hasn't expired, and it is already at the limit —
  // denied. (resetIn is unknown without reading the row; windowMs is a safe
  // upper bound and no caller consumes it.)
  if (!row) {
    return { allowed: false, remaining: 0, resetIn: windowMs };
  }

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

/**
 * Extract the client IP from a Headers object (from a NextRequest or
 * next/headers()). Falls back to "unknown" when the header is absent.
 */
export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Check whether the caller identified by `identifier` (typically an IP or
 * user ID) is allowed through the rate limit configured by `prefix` +
 * `RATE_LIMITS[key]`.  Logs a warning on rejection.  Returns `true` when
 * the request is within the limit, `false` when it should be blocked.
 */
export async function checkRateLimit(
  prefix: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const { allowed } = await rateLimit(rateLimitKey(prefix, identifier), limit, windowMs);
  if (!allowed) {
    console.warn("rate_limited", { route: prefix, identifier });
  }
  return allowed;
}
