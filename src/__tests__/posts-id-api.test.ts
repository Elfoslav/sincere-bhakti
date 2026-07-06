import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/post", () => {
  class NotFoundError extends Error { name = "NotFoundError" as const; }
  class ForbiddenError extends Error { name = "ForbiddenError" as const; }
  return {
    getPostById: vi.fn(),
    deletePost: vi.fn(),
    NotFoundError,
    ForbiddenError,
  };
});
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getPostById, deletePost } from "@/lib/services/post";
import { GET, DELETE } from "@/app/api/posts/[id]/route";

function mockRequest(): any {
  return { headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }) } as any;
}

const basePost = {
  id: "post-1",
  content: "Hare Krishna!",
  isPublic: true,
  createdAt: new Date(),
  author: { id: "user-1", name: "Devotee", image: null },
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

  it("allows author to view private post", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...basePost,
      isPublic: false,
      author: { id: "user-1", name: "Devotee", image: null },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    expect(res.status).toBe(200);
  });

  it("hides private post from non-author as 404", async () => {
    vi.mocked(getPostById).mockResolvedValue({
      ...basePost,
      isPublic: false,
      author: { id: "user-1", name: "Devotee", image: null },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);

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
    vi.mocked(auth).mockResolvedValue(null);

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "post-1" }) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
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
    expect(json.error).toBe("Forbidden");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 });

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
