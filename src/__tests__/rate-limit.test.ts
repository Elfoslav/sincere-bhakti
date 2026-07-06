import { describe, it, expect, vi } from "vitest";

vi.unmock("@/lib/rate-limit");

import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

describe("rateLimitKey", () => {
  it("formats key with prefix and identifier", () => {
    expect(rateLimitKey("register", "127.0.0.1")).toBe("register:127.0.0.1");
  });
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows first request within limit", async () => {
    const result = await rateLimit("test-key", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("tracks remaining requests", async () => {
    await rateLimit("remaining-key", 3, 60_000);
    const second = await rateLimit("remaining-key", 3, 60_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks requests exceeding the limit", async () => {
    await rateLimit("block-key", 2, 60_000);
    await rateLimit("block-key", 2, 60_000);
    const third = await rateLimit("block-key", 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    await rateLimit("reset-key", 1, 50);
    const blocked = await rateLimit("reset-key", 1, 50);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    const after = await rateLimit("reset-key", 1, 50);
    expect(after.allowed).toBe(true);
  });

  it("tracks different keys independently", async () => {
    await rateLimit("user-a", 1, 60_000);
    await rateLimit("user-b", 1, 60_000);
    const a2 = await rateLimit("user-a", 1, 60_000);
    const b2 = await rateLimit("user-b", 1, 60_000);
    expect(a2.allowed).toBe(false);
    expect(b2.allowed).toBe(false);
  });

  it("returns resetIn in milliseconds", async () => {
    const result = await rateLimit("reset-in-key", 5, 10_000);
    expect(result.resetIn).toBeGreaterThan(0);
    expect(result.resetIn).toBeLessThanOrEqual(10_000);
  });
});
