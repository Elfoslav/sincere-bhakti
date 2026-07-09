import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  createUploadUrl: vi.fn(),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { createUploadUrl } from "@/lib/services/upload";
import { POST } from "@/app/api/upload-url/batch/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/upload-url/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(
      mockRequest({ postId: "post-1", files: [{ fileName: "test.jpg", contentType: "image/jpeg", size: 1024 }] }),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when postId is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ files: [{ fileName: "test.jpg", contentType: "image/jpeg", size: 1024 }] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("postId");
  });

  it("returns 400 when files array is empty", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ postId: "post-1", files: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("files");
  });

  it("returns 400 when files exceed max of 10", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const files = Array.from({ length: 11 }, (_, i) => ({
      fileName: `photo-${i}.jpg`,
      contentType: "image/jpeg",
      size: 1024,
    }));
    const res = await POST(mockRequest({ postId: "post-1", files }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("files");
  });

  it("returns 400 when total size exceeds limit", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const files = Array.from({ length: 10 }, (_, i) => ({
      fileName: `photo-${i}.jpg`,
      contentType: "image/jpeg",
      size: 60 * 1024 * 1024, // 60 MB each, 600 MB total > 500 MB
    }));
    const res = await POST(mockRequest({ postId: "post-1", files }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("total_size");
  });

  it("returns upload URLs for all files", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(createUploadUrl)
      .mockResolvedValueOnce({
        uploadUrl: "https://r2.example.com/upload-1",
        publicUrl: "https://pub.r2.dev/posts/post-1/file1.jpg",
        key: "posts/post-1/file1.jpg",
      })
      .mockResolvedValueOnce({
        uploadUrl: "https://r2.example.com/upload-2",
        publicUrl: "https://pub.r2.dev/posts/post-1/file2.jpg",
        key: "posts/post-1/file2.jpg",
      });

    const res = await POST(
      mockRequest({
        postId: "post-1",
        files: [
          { fileName: "file1.jpg", contentType: "image/jpeg", size: 1024 },
          { fileName: "file2.png", contentType: "image/png", size: 2048 },
        ],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.urls).toHaveLength(2);
    expect(json.urls[0].publicUrl).toContain("file1.jpg");
    expect(json.urls[1].publicUrl).toContain("file2.jpg");
    expect(createUploadUrl).toHaveBeenCalledTimes(2);
    expect(createUploadUrl).toHaveBeenCalledWith("file1.jpg", "image/jpeg", "post-1", 1024);
    expect(createUploadUrl).toHaveBeenCalledWith("file2.png", "image/png", "post-1", 2048);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(createUploadUrl).mockRejectedValue(new Error("R2 failure"));

    const res = await POST(
      mockRequest({ postId: "post-1", files: [{ fileName: "test.jpg", contentType: "image/jpeg", size: 1024 }] }),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("failed_to_generate_upload_urls");
  });
});
