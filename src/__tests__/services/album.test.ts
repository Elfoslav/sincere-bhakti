import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  album: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  albumItem: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  media: { findMany: vi.fn() },
  blogPost: { findMany: vi.fn() },
  pendingUpload: { findMany: vi.fn(), deleteMany: vi.fn() },
  channel: { findUnique: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/services/channel", () => ({ isChannelEditor: vi.fn(async () => false) }));
vi.mock("@/lib/services/upload", () => ({
  extractKey: (url: string, domain: string) => url.startsWith(`${domain}/`) ? url.slice(domain.length + 1) : null,
  deleteMediaFiles: vi.fn(),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { createAlbum, getAlbums, updateAlbum, ForbiddenError } from "@/lib/services/album";
import { CHANNEL_AUTHOR_ROLES } from "@/lib/channel-roles";

const url = "https://pub.r2.dev/gallery/a/photo.jpg";
const raw = {
  id: "album-1", title: "Festival", description: "Description", coverUrl: null,
  isPublic: true, language: "en", items: [],
  channel: { id: "channel-1", ownerId: "user-1", avatarUrl: null, translations: [] },
};

describe("album service", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("R2_PUBLIC_URL", "https://pub.r2.dev");
    vi.mocked(prisma.album.findMany).mockResolvedValue([]);
    vi.mocked(prisma.albumItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.media.findMany).mockResolvedValue([]);
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([]);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as never);
    vi.mocked(prisma.album.create).mockResolvedValue(raw as never);
    vi.mocked(prisma.album.findUnique).mockResolvedValue(raw as never);
    vi.mocked(prisma.album.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: unknown) => (cb as (tx: typeof prisma) => unknown)(prisma) as never);
  });

  it("queries public albums using only fields present in Album", async () => {
    await getAlbums({ scope: "public", language: "cs" });
    expect(prisma.album.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { language: "cs", isPublic: true } }));
  });

  it("includes own private albums and excludes another user's private albums", async () => {
    await getAlbums({ scope: "private", channelId: "channel-1" }, "user-1");
    expect(prisma.album.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { channelId: "channel-1", isPublic: false } }));
    await getAlbums({ channelId: "channel-1" }, "user-2");
    expect(prisma.album.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { channelId: "channel-1", isPublic: true } }));
  });

  it("rejects storage media without positive ownership proof", async () => {
    await expect(createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1"))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.album.create).not.toHaveBeenCalled();
  });

  it("accepts a fresh upload owned by the caller", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([{ key: "gallery/a/photo.jpg", userId: "user-1" }] as never);
    await createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1");
    expect(prisma.album.create).toHaveBeenCalled();
  });

  it("rejects uploads belonging to another user", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([{ key: "gallery/a/photo.jpg", userId: "user-2" }] as never);
    await expect(createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1"))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects media already linked by another user", async () => {
    vi.mocked(prisma.albumItem.findMany).mockResolvedValue([{ url, userId: "user-2" }] as never);
    await expect(createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1"))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a cover without an upload or authorable prior reference", async () => {
    await expect(createAlbum({ title: "Festival", description: "Description", channelId: "channel-1", coverUrl: url }, "user-1"))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["album", "blogPost"] as const)("allows reusing a cover only from an authorable %s", async (model) => {
    vi.mocked(prisma[model].findMany).mockResolvedValue([{ coverUrl: url }] as never);
    await createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1");
    expect(prisma[model].findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coverUrl: { in: [url] }, channel: { OR: [
        { ownerId: "user-1" }, { editors: { some: { userId: "user-1", role: { in: [...CHANNEL_AUTHOR_ROLES] } } } },
      ] } },
    }));
  });

  it("accepts the caller's previously linked media without a pending upload", async () => {
    vi.mocked(prisma.media.findMany).mockResolvedValue([{ url, userId: "user-1" }] as never);
    await createAlbum({ title: "Festival", channelId: "channel-1", media: [{ url, type: "image" }] }, "user-1");
    expect(prisma.album.create).toHaveBeenCalled();
  });

  it("preserves a collaborator's unchanged items on edit", async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({ ...raw, items: [{ url }] } as never);
    await updateAlbum("album-1", "user-1", { media: [{ url, type: "image" }] });
    expect(prisma.albumItem.createMany).toHaveBeenCalled();
  });

  it("consumes cover upload claims when creating an album", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([{ key: "gallery/a/photo.jpg", userId: "user-1" }] as never);
    await createAlbum({ title: "Festival", description: "Description", channelId: "channel-1", coverUrl: url }, "user-1");
    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalledWith({ where: { key: { in: ["gallery/a/photo.jpg"] } } });
  });

  it("consumes cover upload claims when updating an album", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([{ key: "gallery/a/photo.jpg", userId: "user-1" }] as never);
    await updateAlbum("album-1", "user-1", { coverUrl: url });
    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalledWith({ where: { key: { in: ["gallery/a/photo.jpg"] } } });
  });
});
