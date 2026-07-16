import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/post", () => {
  class NotFoundError extends Error { name = "NotFoundError" as const; }
  class ForbiddenError extends Error { name = "ForbiddenError" as const; }
  return {
    getPostById: vi.fn(),
    deletePost: vi.fn(),
    updatePost: vi.fn(),
    NotFoundError,
    ForbiddenError,
  };
});
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/channel", () => ({
  canAuthorChannel: vi.fn(),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getPostById, deletePost, updatePost, NotFoundError, ForbiddenError } from "@/lib/services/post";
import { canAuthorChannel } from "@/lib/services/channel";
import { GET, DELETE, PATCH } from "@/app/api/posts/[id]/route";

function mockRequest(): any {
  return { headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }) } as any;
}

const basePost = {
  id: "post-1",
  content: "Hare Krishna!",
  isPublic: true,
  language: "en",
  createdAt: new Date(),
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
  media: [],
};

describe("GET /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a public post", async () => {
    vi.mocked(getPostById).mockResolvedValue(basePost);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("post-1");
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(getPostById).mockResolvedValue(null);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "missing" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("allows owner to view private post", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...basePost,
      isPublic: false,
      channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(canAuthorChannel).mockResolvedValue(true);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    expect(res.status).toBe(200);
  });

  it("allows channel editor to view private post", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...basePost,
      isPublic: false,
      channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: "editor-1" } } as any);
    vi.mocked(canAuthorChannel).mockResolvedValue(true);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });

    expect(res.status).toBe(200);
    expect(canAuthorChannel).toHaveBeenCalledWith("channel-1", "editor-1");
  });

  it("hides private post from non-owner as 404", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...basePost,
      isPublic: false,
      channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);
    vi.mocked(canAuthorChannel).mockResolvedValue(false);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getPostById).mockRejectedValue(new Error("DB down"));

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("failed_to_fetch_post");
  });
});

describe("DELETE /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes own post", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(deletePost).mockResolvedValue(undefined);

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deletePost).toHaveBeenCalledWith("post-1", "user-1");
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { NotFoundError } = await import("@/lib/services/post");
    vi.mocked(deletePost).mockRejectedValue(new NotFoundError());

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "missing" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 403 when not the author", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);
    const { ForbiddenError } = await import("@/lib/services/post");
    vi.mocked(deletePost).mockRejectedValue(new ForbiddenError());

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
  });

  it("returns 500 on service error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(deletePost).mockRejectedValue(new Error("DB down"));

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("failed_to_delete_post");
  });
});

describe("PATCH /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function patchRequest(body: unknown): any {
    return {
      headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000", "Content-Type": "application/json" }),
      json: () => Promise.resolve(body),
    } as any;
  }

  it("updates post content", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(updatePost).mockResolvedValue({ ...basePost, content: "Updated" });

    const res = await PATCH(patchRequest({ content: "Updated" }), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.content).toBe("Updated");
    expect(updatePost).toHaveBeenCalledWith("post-1", "user-1", { content: "Updated" });
  });

  it("updates post visibility", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(updatePost).mockResolvedValue({ ...basePost, isPublic: false });

    const res = await PATCH(patchRequest({ isPublic: false }), { params: Promise.resolve({ id: "post-1" }) });

    expect(res.status).toBe(200);
    expect(updatePost).toHaveBeenCalledWith("post-1", "user-1", { isPublic: false });
  });

  it("returns 401 without auth", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await PATCH(patchRequest({ content: "x" }), { params: Promise.resolve({ id: "post-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(updatePost).mockRejectedValue(new NotFoundError());

    const res = await PATCH(patchRequest({ content: "x" }), { params: Promise.resolve({ id: "missing" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 403 when not the author", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-2" } } as any);
    vi.mocked(updatePost).mockRejectedValue(new ForbiddenError());

    const res = await PATCH(patchRequest({ content: "x" }), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);

    const res = await PATCH(patchRequest({ content: "x" }), { params: Promise.resolve({ id: "post-1" }) });

    expect(res.status).toBe(429);
  });

  it("updates post media", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(updatePost).mockResolvedValue({
      ...basePost,
      media: [{ url: "https://example.com/img.jpg", type: "image", position: 0, width: null, height: null }],
    });

    const res = await PATCH(
      patchRequest({ media: [{ url: "https://example.com/img.jpg", type: "image" }] }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(res.status).toBe(200);
    expect(updatePost).toHaveBeenCalledWith("post-1", "user-1", {
      media: [{ url: "https://example.com/img.jpg", type: "image" }],
    });
  });

  it("rejects invalid media format", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await PATCH(patchRequest({ media: "not-an-array" }), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("media");
  });
});
