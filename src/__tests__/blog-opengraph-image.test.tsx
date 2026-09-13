import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.10" })),
}));
vi.mock("@/lib/services/blog", () => ({
  getCachedBlogPostByShortId: vi.fn(),
  isBlogPubliclyVisible: vi.fn((post: { isPublic: boolean; publishedAt: Date | null }) => {
    if (!post.isPublic) return false;
    if (post.publishedAt && post.publishedAt > new Date()) return false;
    return true;
  }),
}));
vi.mock("@/lib/url", () => ({
  getSiteUrl: vi.fn(() => "https://example.com"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.10"),
  RATE_LIMITS: {
    readBlogOgImage: { limit: 240, windowMs: 60_000 },
  },
  RATE_LIMIT_PREFIX: {
    readBlogOgImage: "read-blog-og-image",
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import sharp from "sharp";
import { getCachedBlogPostByShortId } from "@/lib/services/blog";
import { checkRateLimit } from "@/lib/rate-limit";
import Image from "@/app/[locale]/blog/[shortId]/opengraph-image";

function makeStreamResponse({
  chunks,
  headers,
}: {
  chunks: Uint8Array[];
  headers: Headers;
}) {
  let index = 0;
  const read = vi.fn(async () => {
    if (index >= chunks.length) {
      return { done: true, value: undefined };
    }
    const value = chunks[index];
    index += 1;
    return { done: false, value };
  });

  return {
    ok: true,
    headers,
    body: {
      getReader: () => ({
        read,
        releaseLock: vi.fn(),
      }),
    },
  } as any;
}

async function expectJpegResponse(response: Response) {
  expect(response).toBeInstanceOf(Response);
  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  const buffer = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(630);
  // WhatsApp silently drops preview images over ~600 KB — the entire reason
  // this route serves JPEG instead of Satori's PNG output.
  expect(buffer.length).toBeLessThan(600 * 1024);
  return buffer;
}

const publicPost = {
  isPublic: true,
  publishedAt: new Date("2026-09-01"),
  coverUrl: "https://cdn.example.com/cover.jpg",
};

describe("blog opengraph image", () => {
  const OLD_ENV = process.env.R2_PUBLIC_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    // Covers are trusted by storage origin: point it at the test CDN so the
    // mocked cover URL passes the route's SSRF re-check.
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
  });

  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = OLD_ENV;
  });

  it("returns the fallback JPEG immediately when rate limited (never shared-cached)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    // Logo fetch fails → plain ivory canvas; no network needed in tests.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await Image({ params: Promise.resolve({ locale: "en", shortId: "blog-1" }) });

    expect(checkRateLimit).toHaveBeenCalledWith("read-blog-og-image", "203.0.113.10", 240, 60_000);
    expect(getCachedBlogPostByShortId).not.toHaveBeenCalled();
    await expectJpegResponse(response);
    // A per-IP throttle must NOT poison the shared CDN entry for this URL.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
  });

  it("returns the fallback when the post is missing (briefly cacheable)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedBlogPostByShortId).mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await Image({ params: Promise.resolve({ locale: "en", shortId: "blog-1" }) });

    expect(getCachedBlogPostByShortId).toHaveBeenCalledWith("blog-1", "en");
    await expectJpegResponse(response);
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    expect(cc).not.toContain("no-store");
  });

  it("falls back for scheduled (future-dated) posts", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedBlogPostByShortId).mockResolvedValue({
      ...publicPost,
      publishedAt: new Date(Date.now() + 86_400_000),
    } as never);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await Image({ params: Promise.resolve({ locale: "en", shortId: "blog-1" }) });

    await expectJpegResponse(response);
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
  });

  it("does not shared-cache a transient cover-fetch failure", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedBlogPostByShortId).mockResolvedValue(publicPost as never);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("upstream down"));

    const response = await Image({ params: Promise.resolve({ locale: "en", shortId: "blog-1" }) });

    await expectJpegResponse(response);
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
  });

  it("serves the cover as a 1200x630 cover-cropped JPEG", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedBlogPostByShortId).mockResolvedValue(publicPost as never);

    // A real (tiny) landscape PNG the route will fetch and re-encode.
    const source = await sharp({
      create: { width: 32, height: 18, channels: 3, background: "#c87427" },
    }).png().toBuffer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeStreamResponse({
        chunks: [new Uint8Array(source)],
        headers: new Headers({ "content-type": "image/png" }),
      }),
    );

    const response = await Image({ params: Promise.resolve({ locale: "en", shortId: "blog-1" }) });

    await expectJpegResponse(response);
    // Mutable cover art: bounded TTL, no day-long stale-while-revalidate, so a
    // post going private / changing cover propagates within minutes.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("s-maxage=300");
    expect(cc).not.toContain("stale-while-revalidate");
  });
});
