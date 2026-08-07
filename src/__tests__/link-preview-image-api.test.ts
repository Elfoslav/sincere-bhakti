import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/remote-fetch", () => ({
  fetchRemoteBytes: vi.fn(),
  MAX_LINK_PREVIEW_HTML_BYTES: 2 * 1024 * 1024,
  MAX_LINK_PREVIEW_IMAGE_BYTES: 10 * 1024 * 1024,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { fetchRemoteBytes } from "@/lib/remote-fetch";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET } from "@/app/api/link-preview/image/route";

function mockRequest(url: string) {
  return {
    url,
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
  } as any;
}

describe("GET /api/link-preview/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proxied image bytes with a jpeg content type", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    vi.mocked(fetchRemoteBytes).mockResolvedValue(bytes);

    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg"));
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    expect(body.equals(bytes)).toBe(true);
    expect(fetchRemoteBytes).toHaveBeenCalledWith(
      "https://cdn.example.com/img.jpg",
      expect.objectContaining({ maxBytes: 10 * 1024 * 1024 }),
    );
  });

  it("uses image/png for a .png url", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Fimg.png"));
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("uses image/x-icon for a .ico url", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(Buffer.from([0x00, 0x00, 0x01, 0x00]));
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Ffavicon.ico"));
    expect(res.headers.get("content-type")).toBe("image/x-icon");
  });

  it("rejects svg urls so the proxy cannot serve script-bearing svg", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fevil.example.com%2Fx.svg"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("bad_request");
    expect(fetchRemoteBytes).not.toHaveBeenCalled();
  });

  it("rejects svg urls with query strings", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fevil.example.com%2Fx.svg%3Fv%3D1"));
    expect(res.status).toBe(400);
    expect(fetchRemoteBytes).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing url", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("bad_request");
  });

  it("returns 404 when the upstream fetch yields nothing", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(null);
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg"));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
    // Upstream fetch failure is transient — never shared-cached.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 500 on server error", async () => {
    vi.mocked(fetchRemoteBytes).mockRejectedValue(new Error("boom"));
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg"));
    expect(res.status).toBe(500);
  });

  it("returns 429 and never shared-caches when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview/image?url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg"));
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
    expect(fetchRemoteBytes).not.toHaveBeenCalled();
  });
});
