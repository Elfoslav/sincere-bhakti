import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    media: { findMany: vi.fn() },
    albumItem: { findMany: vi.fn() },
    album: { findMany: vi.fn() },
    blogPost: { findMany: vi.fn() },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { filterOrphanedMediaUrls } from "@/lib/services/media-refs";

describe("filterOrphanedMediaUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.media.findMany).mockResolvedValue([]);
    vi.mocked(prisma.albumItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.album.findMany).mockResolvedValue([]);
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([]);
  });

  it("returns an empty list for no input without querying", async () => {
    const result = await filterOrphanedMediaUrls([]);

    expect(result).toEqual([]);
    expect(prisma.media.findMany).not.toHaveBeenCalled();
  });

  it("treats unreferenced URLs as orphaned", async () => {
    const result = await filterOrphanedMediaUrls(["https://pub.r2.dev/gallery/a/x.jpg"]);

    expect(result).toEqual(["https://pub.r2.dev/gallery/a/x.jpg"]);
  });

  it("keeps URLs still used by another post", async () => {
    vi.mocked(prisma.media.findMany).mockResolvedValue([{ url: "https://pub.r2.dev/posts/p/x.jpg" }]);

    const result = await filterOrphanedMediaUrls(["https://pub.r2.dev/posts/p/x.jpg"]);

    expect(result).toEqual([]);
  });

  it("keeps URLs still used by an album", async () => {
    vi.mocked(prisma.albumItem.findMany).mockResolvedValue([{ url: "https://pub.r2.dev/gallery/a/x.jpg" }]);

    const result = await filterOrphanedMediaUrls(["https://pub.r2.dev/gallery/a/x.jpg"]);

    expect(result).toEqual([]);
  });

  it("keeps URLs still used as a blog cover", async () => {
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([{ coverUrl: "https://pub.r2.dev/blog/b/cover.jpg" }]);

    const result = await filterOrphanedMediaUrls(["https://pub.r2.dev/blog/b/cover.jpg"]);

    expect(result).toEqual([]);
  });

  it("keeps URLs still used solely as an album cover", async () => {
    vi.mocked(prisma.album.findMany).mockResolvedValue([{ coverUrl: "https://pub.r2.dev/gallery/a/cover.jpg" }] as never);
    expect(await filterOrphanedMediaUrls(["https://pub.r2.dev/gallery/a/cover.jpg"])).toEqual([]);
    expect(prisma.album.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coverUrl: { in: ["https://pub.r2.dev/gallery/a/cover.jpg"] } },
    }));
  });

  it("matches URLs ignoring query fragments", async () => {
    vi.mocked(prisma.media.findMany).mockResolvedValue([{ url: "https://pub.r2.dev/posts/p/x.jpg" }]);

    const result = await filterOrphanedMediaUrls(["https://pub.r2.dev/posts/p/x.jpg?v=2"]);

    expect(result).toEqual([]);
  });
});
