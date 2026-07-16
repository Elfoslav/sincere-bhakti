import { describe, it, expect, vi, beforeEach } from "vitest";

const { ImageResponseMock } = vi.hoisted(() => {
  class ImageResponseMock {
    body: unknown;
    init: unknown;
    constructor(body: unknown, init: unknown) {
      this.body = body;
      this.init = init;
    }
  }

  return { ImageResponseMock };
});

vi.mock("next/og", () => ({
  ImageResponse: ImageResponseMock,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.10" })),
}));
vi.mock("@/lib/services/post", () => ({
  getCachedPostById: vi.fn(),
}));
vi.mock("@/lib/url", () => ({
  getSiteUrl: vi.fn(() => "https://example.com"),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.10"),
  RATE_LIMITS: {
    readPosts: { limit: 120, windowMs: 60_000 },
  },
  RATE_LIMIT_PREFIX: {
    readPosts: "read-posts",
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { getCachedPostById } from "@/lib/services/post";
import { checkRateLimit } from "@/lib/rate-limit";
import Image, { fetchImageAsPngBase64 } from "@/app/[locale]/posts/[id]/opengraph-image";

describe("post opengraph image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fallback image immediately when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    expect(getCachedPostById).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(ImageResponseMock);
    expect((response as unknown as InstanceType<typeof ImageResponseMock>).init).toMatchObject({
      width: 1200,
      height: 630,
    });
  });

  it("looks up the post when within quota", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getCachedPostById).mockResolvedValue(null as any);

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    expect(getCachedPostById).toHaveBeenCalledWith("post-1");
    expect(response).toBeInstanceOf(ImageResponseMock);
  });

  it("keeps the abort timeout active until the image body is read", async () => {
    let resolveBody: ((value: ArrayBuffer) => void) | null = null;
    const bodyPromise = new Promise<ArrayBuffer>((resolve) => {
      resolveBody = resolve;
    });

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: () => bodyPromise,
    } as any);

    const imagePromise = fetchImageAsPngBase64("https://cdn.example.com/image.png");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/image.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    if (!resolveBody) throw new Error("body resolver missing");
    (resolveBody as (value: ArrayBuffer) => void)(new Uint8Array([137, 80, 78, 71]).buffer);
    const response = await imagePromise;

    expect(response).toBe("data:image/png;base64,iVBORw==");
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });
});
