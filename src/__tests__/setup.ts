import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@/lib/rate-limit", () => {
  const rateLimit = vi.fn((_key: string, _limit: number, _windowMs: number) => ({ allowed: true, remaining: 29, resetIn: 3_600_000 }));
  const rateLimitKey = vi.fn((p: string, id: string) => `${p}:${id}`);
  return {
    rateLimit,
    rateLimitKey,
    getClientIp: vi.fn((headers: Headers) => headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"),
    checkRateLimit: vi.fn(async (prefix: string, identifier: string, limit: number, windowMs: number) => {
      const { allowed } = await rateLimit(rateLimitKey(prefix, identifier), limit, windowMs);
      if (!allowed) console.warn("rate_limited", { route: prefix, identifier });
      return allowed;
    }),
    RATE_LIMIT_PREFIX: {
      register: "register",
      login: "login",
      readPosts: "read-posts",
      createPost: "create-post",
      updatePost: "update-post",
      deletePost: "delete-post",
      upload: "upload",
      uploadUrl: "upload-url",
      updateProfile: "update-profile",
      readPostDetail: "read-post-detail",
      readProfile: "read-profile",
    },
    RATE_LIMITS: {
      register: { limit: 5, windowMs: 3_600_000 },
      login: { limit: 10, windowMs: 900_000 },
      createPost: { limit: 20, windowMs: 3_600_000 },
      updatePost: { limit: 30, windowMs: 3_600_000 },
      deletePost: { limit: 30, windowMs: 3_600_000 },
      upload: { limit: 60, windowMs: 3_600_000 },
      uploadUrl: { limit: 20, windowMs: 3_600_000 },
      updateProfile: { limit: 10, windowMs: 3_600_000 },
      readPosts: { limit: 120, windowMs: 60_000 },
      readChannel: { limit: 60, windowMs: 60_000 },
      searchChannels: { limit: 30, windowMs: 60_000 },
      readPostDetail: { limit: 120, windowMs: 60_000 },
      readProfile: { limit: 60, windowMs: 60_000 },
    },
  };
});
