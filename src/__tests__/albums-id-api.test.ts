import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/album", () => ({
  getAlbumById: vi.fn(),
  deleteAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    name = "NotFoundError" as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    name = "ForbiddenError" as const;
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
import { getAlbumById, deleteAlbum, updateAlbum, NotFoundError } from "@/lib/services/album";
import { canAuthorChannel } from "@/lib/services/channel";
import { GET, PATCH, DELETE } from "@/app/api/albums/[id]/route";

const album = {
  id: "album-1",
  shortId: "abcd1234",
  slug: "festival",
  title: "Festival",
  description: null,
  coverUrl: null,
  itemCount: 2,
  isPublic: true,
  language: "en",
  createdAt: new Date(),
  updatedAt: new Date(),
  channel: { id: "channel-1", name: "Devotees", slug: "devotees", avatarUrl: null, ownerId: "user-1" },
  items: [],
};

function mockRequest(body?: unknown): NextRequest {
  return {
    url: "http://localhost:3000/api/albums/album-1",
    json: () => Promise.resolve(body ?? {}),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: "album-1" });

describe("GET /api/albums/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the album when public", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);
    vi.mocked(getAlbumById).mockResolvedValue(album as never);

    const res = await GET(mockRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("album-1");
  });

  it("returns 404 when missing", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);
    vi.mocked(getAlbumById).mockResolvedValue(null);

    const res = await GET(mockRequest(), { params });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a private album to strangers", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);
    vi.mocked(getAlbumById).mockResolvedValue({ ...album, isPublic: false } as never);

    const res = await GET(mockRequest(), { params });

    expect(res.status).toBe(404);
    expect(canAuthorChannel).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/albums/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success on delete", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(deleteAlbum).mockResolvedValue(undefined);

    const res = await DELETE(mockRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 404 when the service throws NotFoundError", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(deleteAlbum).mockRejectedValue(new NotFoundError());

    const res = await DELETE(mockRequest(), { params });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/albums/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev";
  });

  it("updates the title", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(updateAlbum).mockResolvedValue({ ...album, title: "New" } as never);

    const res = await PATCH(mockRequest({ title: "New" }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("New");
  });

  it("rejects untrusted media URLs", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await PATCH(
      mockRequest({ media: [{ url: "https://evil.example.com/x.jpg", type: "image" }] }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(updateAlbum).not.toHaveBeenCalled();
  });
});
