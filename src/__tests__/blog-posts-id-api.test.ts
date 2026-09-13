import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/blog", () => ({
  getBlogPostById: vi.fn(),
  deleteBlogPost: vi.fn(),
  updateBlogPost: vi.fn(),
  isBlogPubliclyVisible: vi.fn((post: { isPublic: boolean }) => post.isPublic),
  NotFoundError: class NotFoundError extends Error {
    name = "NotFoundError" as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    name = "ForbiddenError" as const;
  },
  ValidationError: class ValidationError extends Error {
    name = "ValidationError" as const;
  },
}));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/channel", () => ({
  canAuthorChannel: vi.fn(),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getBlogPostById, deleteBlogPost, updateBlogPost } from "@/lib/services/blog";
import { GET, PATCH, DELETE } from "@/app/api/blog-posts/[id]/route";

function mockRequest(body?: unknown): NextRequest {
  return {
    url: "http://localhost:3000/api/blog-posts/blog-1",
    json: body !== undefined ? () => Promise.resolve(body) : undefined,
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as unknown as NextRequest;
}

const mockBlog = {
  id: "blog-1",
  shortId: "shortid1",
  slug: "my-title",
  title: "My Title",
  excerpt: null,
  content: "Hello",
  coverUrl: null,
  isPublic: true,
  language: "en",
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
};

describe("GET /api/blog-posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the public post without auth", async () => {
    vi.mocked(getBlogPostById).mockResolvedValue(mockBlog as never);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "blog-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("My Title");
  });

  it("returns 404 for missing posts", async () => {
    vi.mocked(getBlogPostById).mockResolvedValue(null);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("hides private posts from strangers with 404", async () => {
    vi.mocked(getBlogPostById).mockResolvedValue({ ...mockBlog, isPublic: false } as never);
    const { isBlogPubliclyVisible } = await import("@/lib/services/blog");
    vi.mocked(isBlogPubliclyVisible).mockReturnValue(false);
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "blog-1" }) });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/blog-posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates title and visibility", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(updateBlogPost).mockResolvedValue({ ...mockBlog, title: "New" } as never);

    const res = await PATCH(mockRequest({ title: "New", isPublic: false }), {
      params: Promise.resolve({ id: "blog-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("New");
    expect(updateBlogPost).toHaveBeenCalledWith(
      "blog-1",
      "user-1",
      expect.objectContaining({ title: "New", isPublic: false }),
    );
  });
});

describe("DELETE /api/blog-posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes and returns success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(deleteBlogPost).mockResolvedValue(undefined);

    const res = await DELETE(mockRequest(), { params: Promise.resolve({ id: "blog-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
