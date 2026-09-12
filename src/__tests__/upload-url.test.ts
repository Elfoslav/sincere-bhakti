import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/upload", () => ({
  createUploadUrl: vi.fn(),
  contentTypeToMediaType: vi.fn(),
}));
vi.mock("@/lib/services/channel", () => ({
  resolveAuthorableChannelId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingUpload: {
      create: vi.fn(),
    },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { prisma } from "@/lib/prisma";
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
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: undefined, shouldRefreshPreference: false, explicitForbidden: false });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 403 when the caller's email is not verified", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: null } } as any);

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "11111111-1111-4111-8111-111111111111", contentLength: 100 }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("email_not_verified");
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it("returns upload URL for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-2", shouldRefreshPreference: false, explicitForbidden: false });
    vi.mocked(prisma.pendingUpload.create).mockResolvedValue({} as any);
    vi.mocked(createUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2.example.com/upload-url",
      publicUrl: "https://pub.r2.dev/posts/uuid-test.jpg",
      key: "posts/uuid-test.jpg",
    });
    vi.mocked(contentTypeToMediaType).mockReturnValue("image");

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "11111111-1111-4111-8111-111111111111", channelId: "channel-2", contentLength: 100 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.uploadUrl).toBe("https://r2.example.com/upload-url");
    expect(json.publicUrl).toBe("https://pub.r2.dev/posts/uuid-test.jpg");
    expect(json.mediaType).toBe("image");
    expect(createUploadUrl).toHaveBeenCalledWith("test.jpg", "image/jpeg", "11111111-1111-4111-8111-111111111111", 100, "posts");
    expect(resolveAuthorableChannelId).toHaveBeenCalledWith({
      explicitChannelId: "channel-2",
      preferredChannelId: undefined,
      fallbackChannelId: undefined,
      userId: "user-1",
    });
    expect(prisma.pendingUpload.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ channelId: "channel-2" }),
    }));
  });

  it("returns 403 when channel identity is not authorable", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: undefined, shouldRefreshPreference: false, explicitForbidden: true });

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "11111111-1111-4111-8111-111111111111", channelId: "channel-2", contentLength: 100 }));

    expect(res.status).toBe(403);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it("falls back from stale cookie identity and refreshes cookie", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1", shouldRefreshPreference: true, explicitForbidden: false });
    vi.mocked(prisma.pendingUpload.create).mockResolvedValue({} as any);
    vi.mocked(createUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2.example.com/upload-url",
      publicUrl: "https://pub.r2.dev/posts/uuid-test.jpg",
      key: "posts/uuid-test.jpg",
    });
    vi.mocked(contentTypeToMediaType).mockReturnValue("image");

    const res = await POST({
      ...mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "11111111-1111-4111-8111-111111111111", contentLength: 100 }),
      cookies: { get: () => ({ value: "stale-channel" }) },
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("sb_active_channel_id=channel-1");
  });

  it("accepts a cuid postId for edit-mode uploads to existing posts", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any);
    vi.mocked(prisma.pendingUpload.create).mockResolvedValue({} as any);
    vi.mocked(createUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2.example.com/upload-url",
      publicUrl: "https://pub.r2.dev/posts/cm9x1a2b3c000108l4abcd1234/test.jpg",
      key: "posts/cm9x1a2b3c000108l4abcd1234/test.jpg",
    });
    vi.mocked(contentTypeToMediaType).mockReturnValue("image");

    const res = await POST(mockRequest({ fileName: "test.jpg", contentType: "image/jpeg", postId: "cm9x1a2b3c000108l4abcd1234", contentLength: 100 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.uploadUrl).toBe("https://r2.example.com/upload-url");
    expect(createUploadUrl).toHaveBeenCalledWith("test.jpg", "image/jpeg", "cm9x1a2b3c000108l4abcd1234", 100, "posts");
  });

  it("returns 400 when fileName is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any);

    const res = await POST(mockRequest({ contentType: "image/jpeg" }));
    const json = await res.json();

    expect(json.error).toBeTruthy();
    expect(res.status).toBe(400);
  });
});
