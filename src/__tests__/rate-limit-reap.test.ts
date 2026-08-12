import { describe, it, expect, vi } from "vitest";

const deleteMany = vi.fn().mockResolvedValue({ count: 3 });

vi.mock("@/lib/prisma", () => ({ prisma: { rateLimit: { deleteMany } } }));

// The global test setup mocks @/lib/rate-limit, so load the real module here.
async function realModule() {
  return vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
}

describe("reapExpiredRateLimits", () => {
  it("deletes only rows expired before `now`", async () => {
    deleteMany.mockClear();
    const { reapExpiredRateLimits } = await realModule();
    const now = new Date("2026-08-13T00:00:00.000Z");

    await reapExpiredRateLimits(now);

    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
  });

  it("swallows DB errors so cleanup never breaks the request path", async () => {
    deleteMany.mockRejectedValueOnce(new Error("db down"));
    const { reapExpiredRateLimits } = await realModule();

    await expect(reapExpiredRateLimits(new Date())).resolves.toBeUndefined();
  });

  it("uses a small (<5%) sweep probability so it stays off the hot path", async () => {
    const { RATE_LIMIT_REAP_PROBABILITY } = await realModule();
    expect(RATE_LIMIT_REAP_PROBABILITY).toBeGreaterThan(0);
    expect(RATE_LIMIT_REAP_PROBABILITY).toBeLessThan(0.05);
  });
});
