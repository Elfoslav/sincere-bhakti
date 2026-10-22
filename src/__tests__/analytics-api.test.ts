import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/services/analytics", () => ({ getAnalyticsCounts: vi.fn(), recordAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "192.0.2.1", checkRateLimit: vi.fn(() => true), RATE_LIMITS: { writeAnalytics: { limit: 120, windowMs: 60000 }, readAnalytics: { limit: 120, windowMs: 60000 } }, RATE_LIMIT_PREFIX: { writeAnalytics: "write-analytics", readAnalytics: "read-analytics" } }));
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
import { GET, POST } from "@/app/api/analytics/route";
import { getAnalyticsCounts, recordAnalyticsEvent } from "@/lib/services/analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import { NotFoundError } from "@/lib/services/errors";
const url = "http://localhost/api/analytics?resourceType=blogPost&resourceId=article";
function request(body: unknown = { event: "view", visitId: crypto.randomUUID() }, origin = "http://localhost") {
  return new NextRequest(url, { method: "POST", headers: { host: "localhost", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue(true);
  vi.mocked(getAnalyticsCounts).mockResolvedValue({ views: 1, reads: 0, uniqueVisitors: 1 });
  vi.mocked(recordAnalyticsEvent).mockResolvedValue(undefined);
});
it("returns uncached public counts without collecting", async () => {
  const res = await GET(new NextRequest(url));
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  expect(recordAnalyticsEvent).not.toHaveBeenCalled();
});
it("collects valid events", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(recordAnalyticsEvent).toHaveBeenCalled();
});
it.each(["http://evil.test", ""])("rejects invalid/missing origin %s", async (origin) => {
  expect((await POST(request(undefined, origin))).status).toBe(403);
  expect(recordAnalyticsEvent).not.toHaveBeenCalled();
});
it("rejects invalid events and resources", async () => {
  expect((await POST(request({ event: "purchase", visitId: "bad" }))).status).toBe(400);
  expect((await GET(new NextRequest(url.replace("blogPost", "user")))).status).toBe(400);
  expect(recordAnalyticsEvent).not.toHaveBeenCalled();
});
it("rate limits reads and writes", async () => {
  vi.mocked(checkRateLimit).mockResolvedValue(false);
  expect((await GET(new NextRequest(url))).status).toBe(429);
  expect((await POST(request())).status).toBe(429);
});
it("hides private/missing resources", async () => {
  vi.mocked(getAnalyticsCounts).mockRejectedValue(new NotFoundError());
  expect((await GET(new NextRequest(url))).status).toBe(404);
});
it("returns a generic server error", async () => {
  vi.mocked(recordAnalyticsEvent).mockRejectedValue(new Error("internal detail"));
  const res = await POST(request());
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "server_error" });
});
