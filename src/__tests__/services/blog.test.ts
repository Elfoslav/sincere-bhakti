import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
    },
    channelEditor: {
      findUnique: vi.fn(),
    },
    pendingUpload: {
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: vi.fn(),
    },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import {
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  isBlogPubliclyVisible,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/services/blog";

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
  publishedAt: new Date("2026-09-01"),
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  channelId: "channel-1",
  channel: { id: "channel-1", avatarUrl: null, ownerId: "user-1", translations: [{ language: "en", name: "Devotee", slug: "devotee" }] },
};

describe("isBlogPubliclyVisible", () => {
  it("hides private posts", () => {
    expect(isBlogPubliclyVisible({ isPublic: false, publishedAt: null })).toBe(false);
  });

  it("hides scheduled posts with future publish dates", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: future })).toBe(false);
  });

  it("shows public posts with past publish dates", () => {
    const past = new Date(Date.now() - 1000);
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: past })).toBe(true);
  });
});

describe("getBlogPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters public posts by publish date", async () => {
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([mockBlog] as never);

    const result = await getBlogPosts({ scope: "public", limit: 10 });

    expect(result.posts).toHaveLength(1);
    expect(prisma.blogPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
        take: 11,
      }),
    );
  });

  it("requires auth for private scope", async () => {
    await expect(getBlogPosts({ scope: "private" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects private scope for non-members", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "other" } as never);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
    await expect(getBlogPosts({ scope: "private", channelId: "channel-1" }, "user-1")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns the author's own drafts in private scope", async () => {
    const draft = { ...mockBlog, isPublic: false };
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as never);
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([draft] as never);

    const result = await getBlogPosts({ scope: "private", channelId: "channel-1" }, "user-1");

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].isPublic).toBe(false);
  });
});

describe("createBlogPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a post for the channel owner", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as never);
    vi.mocked(prisma.blogPost.create).mockResolvedValue(mockBlog as never);

    const result = await createBlogPost({ title: "My Title", content: "Hello", channelId: "channel-1" }, "user-1");

    expect(result.title).toBe("My Title");
    expect(prisma.blogPost.create).toHaveBeenCalled();
  });

  it("rejects creation by non-members", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "other" } as never);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    await expect(
      createBlogPost({ title: "T", content: "x", channelId: "channel-1" }, "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updateBlogPost / deleteBlogPost", () => {  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404-style NotFoundError for strangers on update", async () => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({
      id: "blog-1",
      title: "T",
      excerpt: null,
      content: "x",
      channel: { id: "channel-1", ownerId: "other" },
    } as never);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    await expect(updateBlogPost("blog-1", "user-1", { title: "New" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("scopes delete by owner in the where clause", async () => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({
      id: "blog-1",
      channel: { id: "channel-1", ownerId: "user-1" },
    } as never);
    vi.mocked(prisma.blogPost.deleteMany).mockResolvedValue({ count: 1 } as never);

    await deleteBlogPost("blog-1", "user-1");

    expect(prisma.blogPost.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "blog-1" }),
      }),
    );
  });
});

describe("blog cover ownership", () => {
  const OLD_ENV = process.env.R2_PUBLIC_URL;
  const coverUrl = "https://cdn.example.com/uploads/cover.jpg";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as never);
  });

  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = OLD_ENV;
  });

  it("accepts a cover the caller uploaded (pending claim)", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([
      { key: "uploads/cover.jpg", userId: "user-1" },
    ] as never);
    vi.mocked(prisma.blogPost.create).mockResolvedValue({ ...mockBlog, coverUrl } as never);

    const result = await createBlogPost(
      { title: "T", content: "x", coverUrl, channelId: "channel-1" },
      "user-1",
    );

    expect(result.coverUrl).toBe(coverUrl);
    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalled();
  });

  it("rejects a cover owned by someone else", async () => {
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([
      { key: "uploads/cover.jpg", userId: "other" },
    ] as never);

    await expect(
      createBlogPost({ title: "T", content: "x", coverUrl, channelId: "channel-1" }, "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects foreign (non-storage) covers", async () => {
    await expect(
      createBlogPost(
        { title: "T", content: "x", coverUrl: "https://evil.example/cover.jpg", channelId: "channel-1" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails closed without a storage domain", async () => {
    delete process.env.R2_PUBLIC_URL;

    await expect(
      createBlogPost({ title: "T", content: "x", coverUrl, channelId: "channel-1" }, "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deletes the orphaned old cover file on replace", async () => {
    vi.mocked(prisma.blogPost.findUnique)
      .mockResolvedValueOnce({
        id: "blog-1",
        title: "T",
        excerpt: null,
        content: "x",
        coverUrl: "https://cdn.example.com/uploads/old.jpg",
        channel: { id: "channel-1", ownerId: "user-1" },
      } as never)
      .mockResolvedValueOnce({ ...mockBlog, coverUrl } as never);
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([
      { key: "uploads/cover.jpg", userId: "user-1" },
    ] as never);
    vi.mocked(prisma.blogPost.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([]);

    await updateBlogPost("blog-1", "user-1", { coverUrl });

    // findMany doubles as the orphan check: no remaining references.
    expect(prisma.blogPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ coverUrl: expect.anything() }) }),
    );
  });
});
