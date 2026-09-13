import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  // Reuse the real PREFIX/LIMITS so the mock can't silently diverge when new
  // keys are added — only the enforcement functions are stubbed.
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  const rateLimit = vi.fn((_key: string, _limit: number, _windowMs: number) => ({ allowed: true, remaining: 29, resetIn: 3_600_000 }));
  const rateLimitKey = vi.fn((p: string, id: string) => `${p}:${id}`);
  return {
    ...actual,
    rateLimit,
    rateLimitKey,
    getClientIp: vi.fn((headers: Headers) => headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"),
    checkRateLimit: vi.fn(async (prefix: string, identifier: string, limit: number, windowMs: number) => {
      const { allowed } = await rateLimit(rateLimitKey(prefix, identifier), limit, windowMs);
      if (!allowed) console.warn("rate_limited", { route: prefix, identifier });
      return allowed;
    }),
    // NOTE: RATE_LIMIT_PREFIX and RATE_LIMITS intentionally come from
    // `...actual` above — never fork their values here.
  };
});
