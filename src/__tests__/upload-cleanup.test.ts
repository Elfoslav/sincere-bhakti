import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    media: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  deleteMediaFiles: vi.fn(),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/services/upload";
import { POST } from "@/app/api/upload/cleanup/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/upload/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(mockRequest({ urls: ["https://pub.r2.dev/posts/post-1/file.jpg"] }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 for invalid body", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("validation_error");
  });

  it("returns 403 when a URL belongs to another user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.media.findMany).mockResolvedValue([
      { url: "https://pub.r2.dev/posts/post-2/file.jpg", userId: "user-2" },
    ]);

    const res = await POST(
      mockRequest({ urls: ["https://pub.r2.dev/posts/post-2/file.jpg"] }),
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
    expect(deleteMediaFiles).not.toHaveBeenCalled();
  });

  it("deletes orphaned URLs with no Media record", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.media.findMany).mockResolvedValue([]);

    const res = await POST(
      mockRequest({ urls: ["https://pub.r2.dev/posts/post-1/orphan.jpg"] }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deleteMediaFiles).toHaveBeenCalledWith(["https://pub.r2.dev/posts/post-1/orphan.jpg"]);
  });

  it("deletes URLs owned by the requesting user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.media.findMany).mockResolvedValue([
      { url: "https://pub.r2.dev/posts/post-1/file.jpg", userId: "user-1" },
    ]);

    const res = await POST(
      mockRequest({ urls: ["https://pub.r2.dev/posts/post-1/file.jpg"] }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deleteMediaFiles).toHaveBeenCalled();
  });

  it("canonicalizes URLs before ownership check", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.media.findMany).mockResolvedValue([
      { url: "https://pub.r2.dev/posts/post-2/file.jpg", userId: "user-2" },
    ]);

    // Append ?x=1 to bypass the exact URL match
    const res = await POST(
      mockRequest({ urls: ["https://pub.r2.dev/posts/post-2/file.jpg?x=1"] }),
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
    expect(deleteMediaFiles).not.toHaveBeenCalled();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.media.findMany).mockRejectedValue(new Error("DB failure"));

    const res = await POST(mockRequest({ urls: ["https://pub.r2.dev/posts/post-1/file.jpg"] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("cleanup_failed");
  });
});
