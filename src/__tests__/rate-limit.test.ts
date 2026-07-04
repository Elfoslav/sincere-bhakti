import { describe, it, expect } from "vitest";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

describe("rateLimitKey", () => {
  it("formats key with prefix and identifier", () => {
    expect(rateLimitKey("register", "127.0.0.1")).toBe("register:127.0.0.1");
  });
});

describe("rateLimit", () => {
  it("allows first request within limit", () => {
    const result = rateLimit("test-key", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("tracks remaining requests", () => {
    rateLimit("remaining-key", 3, 60_000);
    const second = rateLimit("remaining-key", 3, 60_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks requests exceeding the limit", () => {
    rateLimit("block-key", 2, 60_000);
    rateLimit("block-key", 2, 60_000);
    const third = rateLimit("block-key", 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    rateLimit("reset-key", 1, 50);
    const blocked = rateLimit("reset-key", 1, 50);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    const after = rateLimit("reset-key", 1, 50);
    expect(after.allowed).toBe(true);
  });

  it("tracks different keys independently", () => {
    rateLimit("user-a", 1, 60_000);
    rateLimit("user-b", 1, 60_000);
    const a2 = rateLimit("user-a", 1, 60_000);
    const b2 = rateLimit("user-b", 1, 60_000);
    expect(a2.allowed).toBe(false);
    expect(b2.allowed).toBe(false);
  });

  it("returns resetIn in milliseconds", () => {
    const result = rateLimit("reset-in-key", 5, 10_000);
    expect(result.resetIn).toBeGreaterThan(0);
    expect(result.resetIn).toBeLessThanOrEqual(10_000);
  });
});
