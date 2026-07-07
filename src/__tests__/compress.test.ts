import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  compressR2Object: vi.fn(),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { compressR2Object } from "@/lib/services/upload";
import { POST } from "@/app/api/compress/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/compress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(mockRequest({ key: "posts/post-abc/uuid.jpg" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when key is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("key");
  });

  it("compresses an image and returns result", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(compressR2Object).mockResolvedValue({
      publicUrl: "https://pub.r2.dev/posts/post-abc/compressed.jpg",
      mediaType: "image",
      width: 800,
      height: 600,
      key: "posts/post-abc/compressed.jpg",
    });

    const res = await POST(mockRequest({ key: "posts/post-abc/uuid.jpg" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.width).toBe(800);
    expect(json.height).toBe(600);
    expect(json.mediaType).toBe("image");
    expect(json.publicUrl).toContain("compressed.jpg");
    expect(compressR2Object).toHaveBeenCalledWith("posts/post-abc/uuid.jpg");
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(compressR2Object).mockRejectedValue(new Error("R2 failure"));

    const res = await POST(mockRequest({ key: "posts/post-abc/uuid.jpg" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("compress_failed");
  });
});
