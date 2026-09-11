import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/blog", () => {
  class UnauthorizedError extends Error {
    name = "UnauthorizedError" as const;
  }
  return {
    getBlogPosts: vi.fn(),
    createBlogPost: vi.fn(),
    UnauthorizedError,
    NotFoundError: class NotFoundError extends Error {
      name = "NotFoundError" as const;
    },
    ForbiddenError: class ForbiddenError extends Error {
      name = "ForbiddenError" as const;
    },
    ConflictError: class ConflictError extends Error {
      name = "ConflictError" as const;
    },
    ValidationError: class ValidationError extends Error {
      name = "ValidationError" as const;
    },
  };
});
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/channel", () => ({
  createPersonalChannel: vi.fn(),
  getPersonalChannel: vi.fn(),
  resolveAuthorableChannelId: vi.fn(),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getBlogPosts, createBlogPost } from "@/lib/services/blog";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { GET, POST } from "@/app/api/blog-posts/route";

function mockGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/blog-posts");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return { url: url.toString(), headers: new Headers() } as unknown as NextRequest;
}

function mockPostRequest(body: unknown, activeChannelId?: string): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
    cookies: {
      get: (name: string) => name === "sb_active_channel_id" && activeChannelId
        ? { value: activeChannelId }
        : undefined,
    },
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

describe("GET /api/blog-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public posts with scope=public without auth", async () => {
    vi.mocked(getBlogPosts).mockResolvedValue({ posts: [mockBlog], hasMore: false });

    const res = await GET(mockGetRequest({ scope: "public" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
  });

  it("returns 401 when scope is missing and not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
    expect(getBlogPosts).not.toHaveBeenCalled();
  });

  it("passes channelId and language through", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getBlogPosts).mockResolvedValue({ posts: [], hasMore: false });

    await GET(mockGetRequest({ channelId: "channel-1", language: "cs" }));

    expect(getBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "channel-1", language: "cs" }),
      "user-1",
    );
  });
});

describe("POST /api/blog-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a blog post in the resolved channel", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", emailVerifiedAt: new Date(), channelId: "channel-1" },
    } as never);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1" } as never);
    vi.mocked(createBlogPost).mockResolvedValue(mockBlog as never);

    const res = await POST(mockPostRequest({ title: "My Title", content: "Hello" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.title).toBe("My Title");
    expect(createBlogPost).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Title", channelId: "channel-1" }),
      "user-1",
      "en",
    );
  });

  it("returns 403 when the explicit channel is forbidden", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", emailVerifiedAt: new Date() },
    } as never);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ explicitForbidden: true } as never);

    const res = await POST(mockPostRequest({ title: "T", content: "x", channelId: "other" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("rejects untrusted cover URLs without a storage domain (fail closed)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", emailVerifiedAt: new Date(), channelId: "channel-1" },
    } as never);

    const res = await POST(
      mockPostRequest({ title: "T", content: "x", coverUrl: "https://cdn.example.com/c.jpg" }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("validation_error:coverUrl:untrusted_url");
    expect(createBlogPost).not.toHaveBeenCalled();
  });
});
