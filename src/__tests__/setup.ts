import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetIn: 3_600_000 })),
  rateLimitKey: vi.fn((p: string, id: string) => `${p}:${id}`),
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
  },
}));
