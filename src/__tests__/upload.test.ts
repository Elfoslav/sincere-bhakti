import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  processAndUpload: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { processAndUpload } from "@/lib/services/upload";
import { POST } from "@/app/api/upload/route";

function mockRequest(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return {
    formData: () => Promise.resolve(formData),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const file = new File(["fake"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(mockRequest(file));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when no file provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest(null));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("file");
  });

  it("returns 400 for disallowed content type", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const file = new File(["fake"], "test.svg", { type: "image/svg+xml" });
    const res = await POST(mockRequest(file));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("contentType");
  });

  it("uploads file and returns public URL", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(processAndUpload).mockResolvedValue({
      publicUrl: "https://pub.r2.dev/posts/user-1/uuid-test.jpg",
      mediaType: "image",
      width: 800,
      height: 600,
      key: "posts/user-1/uuid-test.jpg",
    });

    const file = new File(["fake-image-data"], "photo.jpg", { type: "image/jpeg" });
    const res = await POST(mockRequest(file));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.publicUrl).toBe("https://pub.r2.dev/posts/user-1/uuid-test.jpg");
    expect(json.mediaType).toBe("image");
    expect(json.width).toBe(800);
    expect(json.height).toBe(600);
  });
});
