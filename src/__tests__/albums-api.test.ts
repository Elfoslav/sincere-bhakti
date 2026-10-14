import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/album", () => {
  class UnauthorizedError extends Error {
    name = "UnauthorizedError" as const;
  }
  return {
    getAlbums: vi.fn(),
    createAlbum: vi.fn(),
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
import { getAlbums, createAlbum } from "@/lib/services/album";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { GET, POST } from "@/app/api/albums/route";

function mockGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/albums");
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

describe("GET /api/albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 for the public feed", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);
    vi.mocked(getAlbums).mockResolvedValue({ posts: [], hasMore: false });

    const res = await GET(mockGetRequest({ scope: "public" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toEqual([]);
    expect(getAlbums).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "public", requestLanguage: "en" }),
      undefined,
    );
  });

  it("returns 401 for a private scope without auth", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await GET(mockGetRequest({ scope: "private" }));

    expect(res.status).toBe(401);
  });
});

describe("POST /api/albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev";
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(mockPostRequest({ title: "Festival", media: [] }));

    expect(res.status).toBe(401);
    expect(createAlbum).not.toHaveBeenCalled();
  });

  it("rejects untrusted media URLs", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any);
    vi.mocked(resolveAuthorableChannelId).mockResolvedValue({ channelId: "channel-1", shouldRefreshPreference: false, explicitForbidden: false });

    const res = await POST(mockPostRequest({
      title: "Festival",
      media: [{ url: "https://evil.example.com/x.jpg", type: "image" }],
    }));

    expect(res.status).toBe(400);
    expect(createAlbum).not.toHaveBeenCalled();
  });
});
