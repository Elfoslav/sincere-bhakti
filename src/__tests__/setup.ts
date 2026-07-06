import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetIn: 3_600_000 })),
  rateLimitKey: vi.fn((p: string, id: string) => `${p}:${id}`),
}));
