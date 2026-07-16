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
import { getPosts, createPost } from "@/lib/services/post";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { GET, POST } from "@/app/api/posts/route";

function mockGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/posts");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return { url: url.toString() } as unknown as NextRequest;
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

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when no query params provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(getPosts).mockResolvedValue({
      posts: [
        { id: "post-1", content: "Hello", isPublic: true, language: "en", createdAt: new Date(), channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" }, media: [] },
      ],
      hasMore: false,
    });

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: undefined, cursor: undefined, limit: 10, channelId: undefined, language: undefined },
      "user-1",
    );
  });

  it("returns 401 when no query params and not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
    expect(getPosts).not.toHaveBeenCalled();
  });

  it("returns public posts with scope=public", async () => {
    vi.mocked(getPosts).mockResolvedValue({
      posts: [
        { id: "post-1", content: "Public", isPublic: true, language: "en", createdAt: new Date(), channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" }, media: [] },
      ],
      hasMore: false,
    });

    const res = await GET(mockGetRequest({ scope: "public" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: undefined, limit: 10, channelId: undefined, language: undefined },
    );
    expect(auth).not.toHaveBeenCalled();
  });

  it("paginates with cursor", async () => {
    vi.mocked(getPosts).mockResolvedValue({
      posts: [{ id: "post-3", content: "Next page", isPublic: true, language: "en", createdAt: new Date(), channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" }, media: [] }],
      hasMore: false,
    });

    const res = await GET(mockGetRequest({ scope: "public", cursor: "post-2", limit: "2" }));

    expect(res.status).toBe(200);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: "post-2", limit: 2, channelId: undefined, language: undefined },
    );
  });

  it("filters by channelId", async () => {
    vi.mocked(getPosts).mockResolvedValue({ posts: [], hasMore: false });

    const res = await GET(mockGetRequest({ scope: "public", channelId: "channel-1" }));
    expect(res.status).toBe(200);
    expect(getPosts).toHaveBeenCalledWith(
      { scope: "public", cursor: undefined, limit: 10, channelId: "channel-1", language: undefined },
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
    expect(json.error).toBe("failed_to_fetch_posts");
  });
});

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(mockPostRequest({ content: "Hello" }));
    expect(res.status).toBe(401);
  });

  it("creates a post with text only", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1", shouldRefreshPreference: false, explicitForbidden: false });
    vi.mocked(createPost).mockResolvedValue({
      id: "post-1",
      content: "Hare Krishna!",
      isPublic: true,
      language: "en",
      createdAt: new Date(),
      channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
      media: [],
    });

    const res = await POST(mockPostRequest({ content: "Hare Krishna!" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("post-1");
    expect(createPost).toHaveBeenCalledWith(
      { content: "Hare Krishna!", media: [], isPublic: true, language: "en", channelId: "channel-1" },
      "user-1",
    );
  });

  it("creates a post with the active identity cookie channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-2", shouldRefreshPreference: false, explicitForbidden: false });
    vi.mocked(createPost).mockResolvedValue({
      id: "post-2",
      content: "From channel",
      isPublic: true,
      language: "en",
      createdAt: new Date(),
      channel: { id: "channel-2", name: "Kirtan Notes", slug: "kirtan-notes", avatarUrl: null, ownerId: "user-1" },
      media: [],
    });

    const res = await POST(mockPostRequest({ content: "From channel" }, "channel-2"));

    expect(res.status).toBe(201);
    expect(createPost).toHaveBeenCalledWith(
      { content: "From channel", media: [], isPublic: true, language: "en", channelId: "channel-2" },
      "user-1",
    );
  });

  it("falls back and refreshes stale active identity cookie", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1", shouldRefreshPreference: true, explicitForbidden: false });
    vi.mocked(createPost).mockResolvedValue({
      id: "post-3",
      content: "Fallback",
      isPublic: true,
      language: "en",
      createdAt: new Date(),
      channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
      media: [],
    });

    const res = await POST(mockPostRequest({ content: "Fallback" }, "stale-channel"));

    expect(res.status).toBe(201);
    expect(createPost).toHaveBeenCalledWith(
      { content: "Fallback", media: [], isPublic: true, language: "en", channelId: "channel-1" },
      "user-1",
    );
    expect(res.headers.get("set-cookie")).toContain("sb_active_channel_id=channel-1");
  });

  it("returns 403 for explicit non-authorable channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: undefined, shouldRefreshPreference: false, explicitForbidden: true });

    const res = await POST(mockPostRequest({ content: "Nope", channelId: "channel-2" }));

    expect(res.status).toBe(403);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("rejects empty content", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockPostRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 on service error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1", shouldRefreshPreference: false, explicitForbidden: false });
    vi.mocked(createPost).mockRejectedValue(new Error("DB down"));

    const res = await POST(mockPostRequest({ content: "Hello" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("failed_to_create_post");
  });
});
