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
    readPostOgImage: { limit: 240, windowMs: 60_000 },
  },
  RATE_LIMIT_PREFIX: {
    readPostOgImage: "read-post-og-image",
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { getCachedPostById } from "@/lib/services/post";
import { checkRateLimit } from "@/lib/rate-limit";
import Image, { fetchImageAsPngBase64, MAX_OG_IMAGE_BYTES } from "@/app/[locale]/posts/[id]/opengraph-image";

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

describe("post opengraph image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fallback image immediately when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const response = await Image({ params: Promise.resolve({ locale: "en", id: "post-1" }) });

    expect(checkRateLimit).toHaveBeenCalledWith("read-post-og-image", "203.0.113.10", 240, 60_000);
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

    const imagePromise = fetchImageAsPngBase64("https://cdn.example.com/image.png");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/image.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    const bodyResolver = resolveChunk;
    if (!bodyResolver) throw new Error("body resolver missing");
    bodyResolver(new Uint8Array([137, 80, 78, 71]));
    const response = await imagePromise;

    expect(response).toBe("data:image/png;base64,iVBORw==");
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

    const response = await fetchImageAsPngBase64("https://cdn.example.com/image.png");

    expect(response).toBeNull();
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

    const response = await fetchImageAsPngBase64("https://cdn.example.com/image.png");

    expect(response).toBeNull();
  });
});
