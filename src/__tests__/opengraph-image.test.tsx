import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.10" })),
}));
vi.mock("@/lib/services/post", () => ({
  getCachedPostById: vi.fn(),
}));
vi.mock("@/lib/services/channel", () => ({
  getCachedChannelBySlug: vi.fn(),
}));
vi.mock("@/lib/url", () => ({
  getSiteUrl: vi.fn(() => "https://example.com"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.10"),
  RATE_LIMITS: {
    readPostOgImage: { limit: 240, windowMs: 60_000 },
    readChannelOgImage: { limit: 240, windowMs: 60_000 },
  },
  RATE_LIMIT_PREFIX: {
    readPostOgImage: "read-post-og-image",
    readChannelOgImage: "read-channel-og-image",
  },
}));

const mockT = vi.fn((key: string, _params?: Record<string, unknown>) => {
  if (key === "profile.description") return "Profile of {name}.";
  if (key === "channelLabel" || key === "metaDescription") return key === "channelLabel" ? "Channel" : "A devotional channel named {name}.";
  if (key === "title") return "Profile";
  return key;
});
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => mockT),
}));

function MockImageResponse(
  _jsx: any,
  init: { width: number; height: number; headers?: Record<string, string> },
): Response {
  const headers = new Headers({ "Content-Type": "image/png" });
  if (init.headers) {
    for (const [k, v] of Object.entries(init.headers)) {
      headers.set(k, v);
    }
  }
  return new Response("<svg/>", { headers });
}
const ImageResponse = vi.fn(MockImageResponse);
vi.mock("next/og", () => ({ ImageResponse }));

vi.spyOn(console, "error").mockImplementation(() => {});

import sharp from "sharp";
import { getCachedPostById } from "@/lib/services/post";
import { checkRateLimit } from "@/lib/rate-limit";
import Image, { fetchImageBuffer, MAX_OG_IMAGE_BYTES } from "@/app/[locale]/posts/[id]/opengraph-image";

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

describe("post opengraph image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fallback JPEG immediately when rate limited (never shared-cached)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    // Logo fetch fails → plain ivory canvas; no network needed in tests.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    expect(checkRateLimit).toHaveBeenCalledWith("read-post-og-image", "203.0.113.10", 240, 60_000);
    expect(getCachedPostById).not.toHaveBeenCalled();
    await expectJpegResponse(response);
    // A per-IP throttle must NOT poison the shared CDN entry for this URL.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
  });

  it("returns the fallback when the post is missing (briefly cacheable)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedPostById).mockResolvedValue(null as any);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    expect(getCachedPostById).toHaveBeenCalledWith("post-1", "en");
    await expectJpegResponse(response);
    // The "no such post" fallback is the correct response for this URL — safe
    // to cache publicly for a short window.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    expect(cc).not.toContain("no-store");
  });

  it("does not shared-cache a transient image-fetch failure", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    // Post HAS an image, but fetching it fails (upstream timeout/5xx/etc).
    vi.mocked(getCachedPostById).mockResolvedValue({
      isPublic: true,
      media: [{ type: "image", url: "https://cdn.example.com/photo.jpg", width: 1600, height: 900 }],
    } as any);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("upstream down"));

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    await expectJpegResponse(response);
    // A transient blip must not pin the logo fallback on a real post's card.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
  });

  it("serves the post image as a 1200x630 cover-cropped JPEG", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedPostById).mockResolvedValue({
      isPublic: true,
      media: [
        { type: "image", url: "https://cdn.example.com/photo.png", width: 1600, height: 900 },
      ],
    } as any);

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

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    await expectJpegResponse(response);
    // Mutable user photo: bounded TTL, no day-long stale-while-revalidate, so a
    // post going private / changing media propagates within minutes.
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("s-maxage=300");
    expect(cc).not.toContain("stale-while-revalidate");
  });

  it("keeps the abort timeout active until the image body is read", async () => {
    let resolveChunk: ((value: Uint8Array) => void) | undefined;
    const firstChunk = new Promise<Uint8Array>((resolve) => {
      resolveChunk = resolve;
    });
    let readCount = 0;

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      body: {
        getReader: () => ({
          read: vi.fn(async () => {
            if (readCount === 0) {
              readCount += 1;
              return { done: false, value: await firstChunk };
            }
            return { done: true, value: undefined };
          }),
          releaseLock: vi.fn(),
        }),
      },
    } as any);

    const imagePromise = fetchImageBuffer("https://cdn.example.com/image.png");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/image.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    const bodyResolver = resolveChunk;
    if (!bodyResolver) throw new Error("body resolver missing");
    bodyResolver(new Uint8Array([137, 80, 78, 71]));
    const buffer = await imagePromise;

    expect(buffer).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  it("rejects oversized content-length headers before reading the body", async () => {
    const bodyGetReader = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "image/png",
        "content-length": String(MAX_OG_IMAGE_BYTES + 1),
      }),
      body: { getReader: bodyGetReader },
    } as any);

    const buffer = await fetchImageBuffer("https://cdn.example.com/image.png");

    expect(buffer).toBeNull();
    expect(bodyGetReader).not.toHaveBeenCalled();
  });

  it("stops reading once the streamed byte limit is exceeded", async () => {
    const oversized = new Uint8Array(MAX_OG_IMAGE_BYTES + 1);
    const fetchMock = vi.fn().mockResolvedValue(
      makeStreamResponse({
        chunks: [oversized],
        headers: new Headers({ "content-type": "image/png" }),
      }),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as any);

    const buffer = await fetchImageBuffer("https://cdn.example.com/image.png");

    expect(buffer).toBeNull();
  });
});

async function expectPngResponse(response: Response) {
  expect(response).toBeInstanceOf(Response);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  const arrayBuffer = await response.arrayBuffer();
  expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  expect(arrayBuffer.byteLength).toBeLessThan(600 * 1024);
}

describe("channel opengraph image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fallback PNG immediately when rate limited (never shared-cached)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const { default: ChannelImage } = await import("@/app/[locale]/channels/[slug]/opengraph-image");
    const response = await ChannelImage({ params: Promise.resolve({ locale: "en", slug: "my-channel" }) });

    expect(checkRateLimit).toHaveBeenCalledWith("read-channel-og-image", "203.0.113.10", 240, 60_000);
    const { getCachedChannelBySlug } = await import("@/lib/services/channel");
    expect(getCachedChannelBySlug).not.toHaveBeenCalled();
    await expectPngResponse(response);
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).not.toContain("public");
  });

  it("returns the fallback when the channel is missing (briefly cacheable)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    const { getCachedChannelBySlug } = await import("@/lib/services/channel");
    vi.mocked(getCachedChannelBySlug).mockResolvedValue(null as any);

    const { default: ChannelImage } = await import("@/app/[locale]/channels/[slug]/opengraph-image");
    const response = await ChannelImage({ params: Promise.resolve({ locale: "en", slug: "missing-channel" }) });

    expect(getCachedChannelBySlug).toHaveBeenCalledWith("missing-channel", "en");
    await expectPngResponse(response);
    const cc = response.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    expect(cc).not.toContain("no-store");
  });

  it("serves the channel OG image as a 1200x630 PNG", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    const { getCachedChannelBySlug } = await import("@/lib/services/channel");
    vi.mocked(getCachedChannelBySlug).mockResolvedValue({
      id: "ch-1",
      name: "My Devotees",
      slug: "my-devotees",
      avatarUrl: null,
      ownerId: "user-1",
      ownerName: "Devotee",
      ownerImage: null,
      postCount: 5,
      isPersonal: false,
      renameCount: 0,
      createdAt: new Date(),
    } as any);

    const { default: ChannelImage } = await import("@/app/[locale]/channels/[slug]/opengraph-image");
    const response = await ChannelImage({ params: Promise.resolve({ locale: "en", slug: "my-devotees" }) });

    await expectPngResponse(response);
  });
});


