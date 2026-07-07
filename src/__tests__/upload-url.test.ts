import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  createUploadUrl: vi.fn(),
  contentTypeToMediaType: vi.fn(),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { POST } from "@/app/api/upload-url/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns upload URL for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(createUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2.example.com/upload-url",
      publicUrl: "https://pub.r2.dev/posts/uuid-test.jpg",
    });
    vi.mocked(contentTypeToMediaType).mockReturnValue("image");

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "post-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.uploadUrl).toBe("https://r2.example.com/upload-url");
    expect(json.publicUrl).toBe("https://pub.r2.dev/posts/uuid-test.jpg");
    expect(json.mediaType).toBe("image");
    expect(createUploadUrl).toHaveBeenCalledWith("test.jpg", "image/jpeg", "post-1");
  });

  it("returns 400 when fileName is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ contentType: "image/jpeg" }));
    const json = await res.json();

    expect(json.error).toBeTruthy();
    expect(res.status).toBe(400);
  });
});
