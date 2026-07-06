import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getPosts, getPostById, createPost, deletePost, UnauthorizedError, NotFoundError, ForbiddenError } from "@/lib/services/post";

const basePost = {
  id: "post-1",
  content: "Hare Krishna!",
  isPublic: true,
  language: "en",
  authorId: "user-1",
  createdAt: new Date("2026-07-01"),
  author: { id: "user-1", name: "Devotee", image: null },
  media: [],
};

describe("getPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public posts with hasMore=false when under limit", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    const result = await getPosts({ scope: "public", limit: 10 });

    expect(result.posts).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true },
        take: 11,
      }),
    );
  });

  it("returns hasMore=true when over limit", async () => {
    const posts = Array.from({ length: 11 }, (_, i) => ({
      ...basePost,
      id: `post-${i}`,
    }));
    vi.mocked(prisma.post.findMany).mockResolvedValue(posts);

    const result = await getPosts({ scope: "public", limit: 10 });

    expect(result.posts).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });

  it("passes cursor for pagination", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ scope: "public", cursor: "post-0", limit: 10 });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "post-0" },
        skip: 1,
        take: 11,
      }),
    );
  });

  it("filters by authorId", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ scope: "public", authorId: "user-1" });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true, authorId: "user-1" },
      }),
    );
  });

  it("filters by language", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ scope: "public", language: "cs" });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true, language: "cs" },
      }),
    );
  });

  it("returns own posts when no scope", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    const result = await getPosts({}, "user-1");

    expect(result.posts).toHaveLength(1);
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-1" },
      }),
    );
  });

  it("throws when no scope and no userId", async () => {
    await expect(getPosts({})).rejects.toThrow(UnauthorizedError);
  });

  it("restricts to public posts when requesting another user's posts without scope", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ authorId: "user-2" }, "user-1");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-2", isPublic: true },
      }),
    );
  });

  it("returns own posts (public + private) when authorId matches current user", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ authorId: "user-1" }, "user-1");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-1" },
      }),
    );
  });
});

describe("getPostById", () => {
  it("returns post when found", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(basePost);

    const post = await getPostById("post-1");
    expect(post).toEqual(basePost);
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

    const post = await getPostById("missing");
    expect(post).toBeNull();
  });
});

describe("createPost", () => {
  it("creates post with text and media", async () => {
    const media = [{ url: "https://r2.dev/img.jpg", type: "image" }];
    vi.mocked(prisma.post.create).mockResolvedValue({
      ...basePost,
      media: [{ url: "https://r2.dev/img.jpg", type: "image", position: 0 }],
    });

    const post = await createPost({ content: "Hare Krishna!", media }, "user-1");

    expect(post.content).toBe("Hare Krishna!");
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Hare Krishna!",
          authorId: "user-1",
          media: {
            create: [{ url: "https://r2.dev/img.jpg", type: "image", position: 0, userId: "user-1" }],
          },
        }),
      }),
    );
  });

  it("defaults isPublic to true", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost);

    await createPost({ content: "Hello" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it("sets private post", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue({ ...basePost, isPublic: false });

    await createPost({ content: "Secret", isPublic: false }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublic: false }),
      }),
    );
  });

  it("defaults language to en", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost);

    await createPost({ content: "Hello" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: "en" }),
      }),
    );
  });

  it("stores specified language", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost);

    await createPost({ content: "Ahoj", language: "cs" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: "cs" }),
      }),
    );
  });
});

describe("deletePost", () => {
  it("deletes own post", async () => {
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 });

    await deletePost("post-1", "user-1");

    expect(prisma.post.deleteMany).toHaveBeenCalledWith({
      where: { id: "post-1", authorId: "user-1" },
    });
  });

  it("throws when post not found", async () => {
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

    await expect(deletePost("missing", "user-1")).rejects.toThrow(NotFoundError);
  });

  it("throws when not the author", async () => {
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.post.findUnique).mockResolvedValue(basePost);

    await expect(deletePost("post-1", "user-2")).rejects.toThrow(ForbiddenError);
  });
});
