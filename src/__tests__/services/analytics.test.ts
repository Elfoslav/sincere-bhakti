import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
vi.mock("@/lib/prisma", () => {
  const prisma = {
    blogPost: { findUnique: vi.fn(), count: vi.fn() },
    analyticsReceipt: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    analyticsDaily: { upsert: vi.fn(), groupBy: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((cb) => cb(prisma));
  return { prisma };
});
import { prisma } from "@/lib/prisma";
import { getAnalyticsCounts, recordAnalyticsEvent, cleanupExpiredAnalyticsReceipts } from "@/lib/services/analytics";
const headers = new Headers({ "user-agent": "Browser" });
const event = { resourceType: "blogPost" as const, resourceId: "article", event: "view" as const, visitId: crypto.randomUUID() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  vi.stubEnv("ANALYTICS_SECRET", randomBytes(32).toString("hex"));
  vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({ isPublic: true, publishedAt: null } as never);
  vi.mocked(prisma.blogPost.count).mockResolvedValue(1);
  vi.mocked(prisma.analyticsReceipt.createMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.analyticsReceipt.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.analyticsReceipt.findMany).mockResolvedValue([]);
  vi.mocked(prisma.analyticsDaily.groupBy).mockResolvedValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("content analytics", () => {
  it.each([null, { isPublic: false, publishedAt: null }, { isPublic: true, publishedAt: new Date("2099-01-01") }])("hides missing/private/future resources", async (post) => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(post as never);
    await expect(getAnalyticsCounts(event)).rejects.toThrow();
    await expect(recordAnalyticsEvent(event, headers, "192.0.2.1")).rejects.toThrow();
    expect(prisma.analyticsDaily.upsert).not.toHaveBeenCalled();
  });
  it("records a visit and unique daily visitor without storing raw identifiers", async () => {
    await recordAnalyticsEvent(event, headers, "192.0.2.1");
    expect(prisma.analyticsDaily.upsert).toHaveBeenCalledTimes(2);
    const receiptCalls = JSON.stringify(vi.mocked(prisma.analyticsReceipt.createMany).mock.calls);
    expect(receiptCalls).not.toContain("192.0.2.1");
    expect(receiptCalls).not.toContain("Browser");
    expect(receiptCalls).not.toContain(event.visitId);
    const receipts = vi.mocked(prisma.analyticsReceipt.createMany).mock.calls;
    expect(receipts[0][0].skipDuplicates).toBe(true);
    expect(receipts[0][0].data).toEqual([expect.objectContaining({ expiresAt: new Date("2026-10-24T12:00:00Z") })]);
  });
  it("does not count a retried visit twice", async () => {
    vi.mocked(prisma.analyticsReceipt.createMany).mockResolvedValue({ count: 0 });
    await recordAnalyticsEvent(event, headers, "192.0.2.1");
    expect(prisma.analyticsDaily.upsert).not.toHaveBeenCalled();
  });
  it("counts a repeat visit but not another unique visitor", async () => {
    vi.mocked(prisma.analyticsReceipt.createMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await recordAnalyticsEvent(event, headers, "192.0.2.1");
    expect(prisma.analyticsDaily.upsert).toHaveBeenCalledTimes(1);
  });
  it("requires an unread, unexpired visit older than 30 seconds for a read", async () => {
    vi.mocked(prisma.analyticsReceipt.updateMany).mockResolvedValue({ count: 0 });
    await recordAnalyticsEvent({ ...event, event: "read" }, headers, "192.0.2.1");
    expect(prisma.analyticsReceipt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ readAt: null, createdAt: { lte: new Date("2026-10-22T11:59:30Z") }, expiresAt: { gt: new Date() } }) }));
    expect(prisma.analyticsDaily.upsert).not.toHaveBeenCalled();
  });
  it("counts an accepted read only once and does not increment views", async () => {
    await recordAnalyticsEvent({ ...event, event: "read" }, headers, "192.0.2.1");
    expect(prisma.analyticsDaily.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.analyticsDaily.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ metric: "reads" }) }));
  });
  it("rotates unique keys by day and resource", async () => {
    await recordAnalyticsEvent(event, headers, "192.0.2.1");
    vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    await recordAnalyticsEvent(event, headers, "192.0.2.1");
    await recordAnalyticsEvent({ ...event, resourceId: "another" }, headers, "192.0.2.1");
    const calls = vi.mocked(prisma.analyticsReceipt.createMany).mock.calls;
    const key = (index: number) => (calls[index][0].data as { key: string }[])[0].key;
    expect(new Set([key(1), key(3), key(5)]).size).toBe(3);
  });
  it.each([{ dnt: "1" }, { "sec-gpc": "1" }, { "user-agent": "Googlebot" }])("honors privacy signals and filters bots", async (extra) => {
    await recordAnalyticsEvent(event, new Headers(extra), "192.0.2.1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("does not invent a unique visitor when the client IP is unavailable", async () => {
    await recordAnalyticsEvent(event, headers, "unknown");
    expect(prisma.analyticsDaily.upsert).toHaveBeenCalledTimes(1);
  });
  it("returns aggregate counts with zero defaults", async () => {
    vi.mocked(prisma.analyticsDaily.groupBy).mockResolvedValue([{ metric: "views", _sum: { count: 7 } }] as never);
    expect(await getAnalyticsCounts(event)).toEqual({ views: 7, reads: 0, uniqueVisitors: 0 });
  });
});

it("prunes expired receipts in a bounded batch", async () => {
  vi.mocked(prisma.analyticsReceipt.findMany).mockResolvedValue([{ key: "expired" }] as never);
  vi.mocked(prisma.analyticsReceipt.deleteMany).mockResolvedValue({ count: 1 });
  expect(await cleanupExpiredAnalyticsReceipts()).toBe(1);
  expect(prisma.analyticsReceipt.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, where: { expiresAt: { lt: new Date() } } }));
  expect(prisma.analyticsReceipt.deleteMany).toHaveBeenCalledWith({ where: { key: { in: ["expired"] } } });
});
it("rechecks visibility before writing counters", async () => {
  vi.mocked(prisma.blogPost.count).mockResolvedValue(0);
  await expect(recordAnalyticsEvent(event, headers, "192.0.2.1")).rejects.toThrow();
  expect(prisma.analyticsReceipt.createMany).not.toHaveBeenCalled();
});
