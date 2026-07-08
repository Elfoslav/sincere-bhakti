import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBatchResponse = vi.fn();
const mockCompressResponse = vi.fn();
let putCallCount = 0;

vi.mock("@/lib/services/post", () => ({
  MediaInput: class {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  putCallCount = 0;

  vi.spyOn(global, "fetch").mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr === "/api/upload-url/batch") {
      return mockBatchResponse();
    }

    if (urlStr.startsWith("https://presigned.example.com/")) {
      putCallCount++;
      const ok = !urlStr.includes("fail");
      return { ok, status: ok ? 200 : 500 } as Response;
    }

    if (urlStr === "/api/compress") {
      return mockCompressResponse();
    }

    if (urlStr === "/api/upload/cleanup") {
      return { ok: true } as Response;
    }

    return { ok: false } as Response;
  });
});

describe("uploadMediaFiles", () => {
  it("returns empty when no items given", async () => {
    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", []);
    expect(result).toEqual({ media: [], error: null });
  });

  it("returns rate_limited on 429 from batch endpoint", async () => {
    mockBatchResponse.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "too_many_requests" }),
    });

    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", [
      { file: new File(["data"], "test.jpg", { type: "image/jpeg" }) },
    ]);
    expect(result.error).toBe("rate_limited");
  });

  it("returns upload_failed on batch endpoint error", async () => {
    mockBatchResponse.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "validation_error:files:too_big" }),
    });

    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", [
      { file: new File(["data"], "test.jpg", { type: "image/jpeg" }) },
    ]);
    expect(result.error).toBe("upload_failed");
  });

  it("returns upload_failed and collects all successes when some uploads fail", async () => {
    mockBatchResponse.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          urls: [
            { uploadUrl: "https://presigned.example.com/success-1", publicUrl: "https://pub.example.com/a.jpg", key: "a" },
            { uploadUrl: "https://presigned.example.com/fail-1", publicUrl: "https://pub.example.com/b.jpg", key: "b" },
            { uploadUrl: "https://presigned.example.com/success-2", publicUrl: "https://pub.example.com/c.jpg", key: "c" },
          ],
        }),
    });

    mockCompressResponse.mockResolvedValue({ ok: false });

    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", [
      { file: new File(["data"], "a.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
      { file: new File(["data"], "b.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
      { file: new File(["data"], "c.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
    ]);

    expect(result.error).toBe("upload_failed");
    // Should have collected both successful uploads despite the middle failure
    expect(result.media).toHaveLength(2);
    expect(result.media[0].url).toBe("https://pub.example.com/a.jpg");
    expect(result.media[1].url).toBe("https://pub.example.com/c.jpg");
    expect(putCallCount).toBe(3);
  });

  it("succeeds when all uploads succeed", async () => {
    mockBatchResponse.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          urls: [
            { uploadUrl: "https://presigned.example.com/success-1", publicUrl: "https://pub.example.com/a.jpg", key: "a" },
            { uploadUrl: "https://presigned.example.com/success-2", publicUrl: "https://pub.example.com/b.jpg", key: "b" },
          ],
        }),
    });

    mockCompressResponse.mockResolvedValue({ ok: false });

    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", [
      { file: new File(["data"], "a.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
      { file: new File(["data"], "b.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
    ]);

    expect(result.error).toBeNull();
    expect(result.media).toHaveLength(2);
  });

  it("includes compress response data when compress succeeds", async () => {
    mockBatchResponse.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          urls: [
            { uploadUrl: "https://presigned.example.com/success-1", publicUrl: "https://pub.example.com/a.jpg", key: "a" },
          ],
        }),
    });

    mockCompressResponse.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ mediaType: "image", width: 800, height: 600 }),
    });

    const { uploadMediaFiles } = await import("@/lib/client-upload");
    const result = await uploadMediaFiles("post-1", [
      { file: new File(["data"], "a.jpg", { type: "image/jpeg" }), width: 100, height: 100 },
    ]);

    expect(result.error).toBeNull();
    expect(result.media[0].width).toBe(800);
    expect(result.media[0].height).toBe(600);
  });
});

describe("cleanupUploadedMedia", () => {
  it("sends POST to cleanup endpoint with URLs", async () => {
    const { cleanupUploadedMedia } = await import("@/lib/client-upload");
    await cleanupUploadedMedia(["https://pub.example.com/a.jpg", "https://pub.example.com/b.jpg"]);

    expect(fetch).toHaveBeenCalledWith("/api/upload/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["https://pub.example.com/a.jpg", "https://pub.example.com/b.jpg"] }),
    });
  });
});
