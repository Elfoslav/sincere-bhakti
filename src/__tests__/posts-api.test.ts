import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/post", () => {
  class UnauthorizedError extends Error {
    name = "UnauthorizedError" as const;
  }
  return {
    getPosts: vi.fn(),
    createPost: vi.fn(),
    getPostById: vi.fn(),
    deletePost: vi.fn(),
    UnauthorizedError,
    NotFoundError: class NotFoundError extends Error {
      name = "NotFoundError" as const;
    },
    ForbiddenError: class ForbiddenError extends Error {
      name = "ForbiddenError" as const;
    },
  };
});
vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getPosts, createPost } from "@/lib/services/post";
import { GET, POST } from "@/app/api/posts/route";

function mockGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/posts");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return { url: url.toString() } as unknown as NextRequest;
}

function mockPostRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when no query params provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(getPosts).mockResolvedValue({
      posts: [
        { id: "post-1", content: "Hello", isPublic: true, createdAt: new Date(), author: { id: "user-1", name: "Devotee", image: null }, media: [] },
      ],
      hasMore: false,
    });

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: undefined, cursor: undefined, limit: 10, authorId: undefined },
      "user-1",
    );
  });

  it("returns 401 when no query params and not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(getPosts).not.toHaveBeenCalled();
  });

  it("returns public posts with scope=public", async () => {
    vi.mocked(getPosts).mockResolvedValue({
      posts: [
        { id: "post-1", content: "Public", isPublic: true, createdAt: new Date(), author: { id: "user-1", name: "Devotee", image: null }, media: [] },
      ],
      hasMore: false,
    });

    const res = await GET(mockGetRequest({ scope: "public" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: undefined, limit: 10, authorId: undefined },
    );
    expect(auth).not.toHaveBeenCalled();
  });

  it("paginates with cursor", async () => {
    vi.mocked(getPosts).mockResolvedValue({
      posts: [{ id: "post-3", content: "Next page", isPublic: true, createdAt: new Date(), author: { id: "user-2", name: "Disciple", image: null }, media: [] }],
      hasMore: false,
    });

    const res = await GET(mockGetRequest({ scope: "public", cursor: "post-2", limit: "2" }));

    expect(res.status).toBe(200);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: "post-2", limit: 2, authorId: undefined },
    );
  });

  it("filters by authorId", async () => {
    vi.mocked(getPosts).mockResolvedValue({ posts: [], hasMore: false });

    const res = await GET(mockGetRequest({ scope: "public", authorId: "user-1" }));
    expect(res.status).toBe(200);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: undefined, limit: 10, authorId: "user-1" },
    );
  });

  it("rejects limit over 50", async () => {
    const res = await GET(mockGetRequest({ scope: "public", limit: "100" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on service error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(getPosts).mockRejectedValue(new Error("DB down"));

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to fetch posts");
  });
});

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(mockPostRequest({ content: "Hello" }));
    expect(res.status).toBe(401);
  });

  it("creates a post with text only", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(createPost).mockResolvedValue({
      id: "post-1",
      content: "Hare Krishna!",
      isPublic: true,
      createdAt: new Date(),
      author: { id: "user-1", name: "Devotee", image: null },
      media: [],
    });

    const res = await POST(mockPostRequest({ content: "Hare Krishna!" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("post-1");
    expect(createPost).toHaveBeenCalledWith(
      { content: "Hare Krishna!", media: [], isPublic: true },
      "user-1",
    );
  });

  it("rejects empty content", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockPostRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 on service error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(createPost).mockRejectedValue(new Error("DB down"));

    const res = await POST(mockPostRequest({ content: "Hello" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to create post");
  });
});
