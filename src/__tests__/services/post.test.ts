import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    media: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      // Orphan detection: defaults to "nothing else references these URLs".
      findMany: vi.fn(() => Promise.resolve([])),
    },
    channel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    channelEditor: {
      findUnique: vi.fn(),
    },
    pendingUpload: {
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => any) => cb(prisma)),
  },
}));

import { prisma } from "@/lib/prisma";
import { getPosts, getPostById, createPost, deletePost, updatePost, UnauthorizedError, NotFoundError, ForbiddenError } from "@/lib/services/post";

const basePost = {
  id: "post-1",
  content: "Hare Krishna!",
  isPublic: true,
  language: "en",
  channelId: "channel-1",
  createdAt: new Date("2026-07-01"),
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
  media: [],
};

describe("getPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.media.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([]);
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

  it("filters by channelId", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ scope: "public", channelId: "channel-1" });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true, channelId: "channel-1" },
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
    // Scoped to the user's channels via the relation — no separate channel query.
    expect(prisma.channel.findMany).not.toHaveBeenCalled();
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { channel: { ownerId: "user-1" } },
            { channel: { editors: { some: { userId: "user-1" } } } },
          ],
        },
      }),
    );
  });

  it("throws when no scope and no userId", async () => {
    await expect(getPosts({})).rejects.toThrow(UnauthorizedError);
  });

  it("returns own channel posts with no scope (non-owner returns public only)", async () => {
    // User-2 requests channel-1's posts — gets only public ones
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ channelId: "channel-1" }, "user-2");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1", isPublic: true },
      }),
    );
  });

  it("returns all channel posts when requester is channel editor", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-2" } as any);
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ channelId: "channel-1" }, "user-2");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1" },
      }),
    );
  });

  it("returns all posts when scope is own channelId", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ channelId: "channel-1" }, "user-1");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1" },
      }),
    );
  });

  it("returns private posts for own channelId with private scope", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ channelId: "channel-1", scope: "private" }, "user-1");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1", isPublic: false },
      }),
    );
  });

  it("throws UnauthorizedError when private scope requested for non-authorable channel", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);

    await expect(
      getPosts({ channelId: "channel-1", scope: "private" }, "user-2"),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("returns private posts when private scope requested by channel editor", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "channel-1", ownerId: "user-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-2" } as any);
    vi.mocked(prisma.post.findMany).mockResolvedValue([basePost]);

    await getPosts({ channelId: "channel-1", scope: "private" }, "user-2");

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1", isPublic: false },
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
  beforeEach(() => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
  });

  it("creates post with text and media, persisting dimensions", async () => {
    const media = [{ url: "https://r2.dev/img.jpg", type: "image", width: 1600, height: 900 }];
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    const post = await createPost({ content: "Hare Krishna!", media, channelId: "channel-1" }, "user-1");

    expect(post.content).toBe("Hare Krishna!");
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Hare Krishna!",
          channelId: "channel-1",
          media: {
            create: [{ url: "https://r2.dev/img.jpg", type: "image", position: 0, width: 1600, height: 900, userId: "user-1" }],
          },
        }),
      }),
    );
  });

  it("defaults missing dimensions to null", async () => {
    const media = [{ url: "https://r2.dev/img.jpg", type: "image" }];
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    await createPost({ media, channelId: "channel-1" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          media: {
            create: [{ url: "https://r2.dev/img.jpg", type: "image", position: 0, width: null, height: null, userId: "user-1" }],
          },
        }),
      }),
    );
  });

  it("defaults isPublic to true", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    await createPost({ content: "Hello", channelId: "channel-1" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it("sets private post", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue({ ...basePost, isPublic: false } as any);

    await createPost({ content: "Secret", isPublic: false, channelId: "channel-1" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublic: false }),
      }),
    );
  });

  it("defaults language to en", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    await createPost({ content: "Hello", channelId: "channel-1" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: "en" }),
      }),
    );
  });

  it("stores specified language", async () => {
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    await createPost({ content: "Ahoj", language: "cs", channelId: "channel-1" }, "user-1");

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: "cs" }),
      }),
    );
  });

  it("throws when channelId is missing", async () => {
    await expect(createPost({ content: "Hello" }, "user-1")).rejects.toThrow("channel_required");
  });

  it("throws when channel is not found", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

    await expect(createPost({ content: "Hello", channelId: "missing" }, "user-1")).rejects.toThrow("channel_not_found");
  });

  it("throws when user is not channel owner nor editor", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    await expect(createPost({ content: "Hello", channelId: "channel-1" }, "user-1")).rejects.toThrow("not_channel_author");
  });

  it("allows post creation for channel editors", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.post.create).mockResolvedValue(basePost as any);

    const post = await createPost({ content: "Editor post", channelId: "channel-1" }, "user-1");

    expect(post.content).toBe("Hare Krishna!");
  });
});

describe("deletePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
  });

  it("deletes own post", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      ...basePost,
      channel: { ownerId: "user-1" },
    } as any);
    vi.mocked(prisma.post.delete).mockResolvedValue({ ...basePost, channel: { ownerId: "user-1" } } as any);

    await deletePost("post-1", "user-1");

    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: "post-1" },
      include: { media: { select: { url: true } }, channel: { select: { id: true, ownerId: true } } },
    });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        OR: [
          { channel: { ownerId: "user-1" } },
          { channel: { editors: { some: { userId: "user-1" } } } },
        ],
      },
    });
  });

  it("allows channel editor to delete post", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      ...basePost,
      channel: { id: "channel-1", ownerId: "user-2" },
    } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-1" } as any);

    await deletePost("post-1", "user-1");

    expect(prisma.post.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        OR: [
          { channel: { ownerId: "user-1" } },
          { channel: { editors: { some: { userId: "user-1" } } } },
        ],
      },
    });
  });

  it("throws when post not found", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

    await expect(deletePost("missing", "user-1")).rejects.toThrow(NotFoundError);
  });

  it("throws when not the author", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ ...basePost, channel: { ownerId: "user-1" } } as any);

    await expect(deletePost("post-1", "user-2")).rejects.toThrow(ForbiddenError);
  });
});

describe("updatePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
  });

  it("updates own post content", async () => {
    vi.mocked(prisma.post.findUnique)
      .mockResolvedValueOnce({ ...basePost, channel: { ownerId: "user-1" } } as any)
      .mockResolvedValueOnce({ ...basePost, content: "Updated!", channel: { ownerId: "user-1" } } as any);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

    const result = await updatePost("post-1", "user-1", { content: "Updated!" });

    expect(result.content).toBe("Updated!");
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        OR: [
          { channel: { ownerId: "user-1" } },
          { channel: { editors: { some: { userId: "user-1" } } } },
        ],
      },
      data: { content: "Updated!" },
    });
  });

  it("allows channel editor to update post", async () => {
    vi.mocked(prisma.post.findUnique)
      .mockResolvedValueOnce({ ...basePost, channel: { id: "channel-1", ownerId: "user-2" } } as any)
      .mockResolvedValueOnce({ ...basePost, content: "Updated!", channel: { id: "channel-1", ownerId: "user-2" } } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

    const result = await updatePost("post-1", "user-1", { content: "Updated!" });

    expect(result.content).toBe("Updated!");
  });

  it("allows editor to keep existing media owned by another user while editing", async () => {
    const previousR2PublicUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    try {
      const existingMedia = { url: "https://cdn.example.com/posts/post-1/owner.jpg" };
      vi.mocked(prisma.post.findUnique)
        .mockResolvedValueOnce({
          ...basePost,
          media: [existingMedia],
          channel: { id: "channel-1", ownerId: "user-2" },
        } as any)
        .mockResolvedValueOnce({
          ...basePost,
          content: "Edited by editor",
          media: [{ ...existingMedia, type: "image", position: 0, width: null, height: null }],
          channel: { id: "channel-1", ownerId: "user-2" },
        } as any);
      vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "editor-1" } as any);
      vi.mocked(prisma.media.findMany)
        .mockResolvedValueOnce([{ url: existingMedia.url, userId: "owner-1" }] as any)
        .mockResolvedValue([]);
      vi.mocked(prisma.pendingUpload.findMany).mockResolvedValue([]);
      vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

      const result = await updatePost("post-1", "editor-1", {
        content: "Edited by editor",
        media: [{ url: existingMedia.url, type: "image" }],
      });

      expect(result.content).toBe("Edited by editor");
    } finally {
      process.env.R2_PUBLIC_URL = previousR2PublicUrl;
    }
  });

  it("rejects editor adding media owned by another user", async () => {
    const previousR2PublicUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    try {
      const newMedia = { url: "https://cdn.example.com/posts/other-post/owner.jpg", type: "image" as const };
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
        ...basePost,
        media: [],
        channel: { id: "channel-1", ownerId: "user-2" },
      } as any);
      vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "editor-1" } as any);
      vi.mocked(prisma.media.findMany).mockResolvedValue([{ url: newMedia.url, userId: "owner-1" }] as any);

      await expect(updatePost("post-1", "editor-1", { media: [newMedia] })).rejects.toThrow(ForbiddenError);
    } finally {
      process.env.R2_PUBLIC_URL = previousR2PublicUrl;
    }
  });

  it("updates post visibility", async () => {
    vi.mocked(prisma.post.findUnique)
      .mockResolvedValueOnce({ ...basePost, channel: { ownerId: "user-1" } } as any)
      .mockResolvedValueOnce({ ...basePost, isPublic: false, channel: { ownerId: "user-1" } } as any);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

    const result = await updatePost("post-1", "user-1", { isPublic: false });

    expect(result.isPublic).toBe(false);
  });

  it("throws when post not found", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

    await expect(updatePost("missing", "user-1", { content: "x" })).rejects.toThrow(NotFoundError);
  });

  it("throws when not the owner", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({ ...basePost, channel: { ownerId: "user-1" } } as any);

    await expect(updatePost("post-1", "user-2", { content: "x" })).rejects.toThrow(NotFoundError);
  });

  it("replaces media when provided", async () => {
    vi.mocked(prisma.post.findUnique)
      .mockResolvedValueOnce({ ...basePost, channel: { ownerId: "user-1" } } as any)
      .mockResolvedValueOnce({
        ...basePost,
        media: [
          { id: "media-1", url: "https://example.com/new.jpg", type: "image", position: 0, width: null, height: null, createdAt: new Date(), postId: "post-1", userId: "user-1" },
        ],
        channel: { ownerId: "user-1" },
      } as any);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

    const result = await updatePost("post-1", "user-1", {
      media: [{ url: "https://example.com/new.jpg", type: "image" }],
    });

    expect(prisma.media.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(prisma.media.createMany).toHaveBeenCalledWith({
      data: [{ url: "https://example.com/new.jpg", type: "image", position: 0, width: null, height: null, postId: "post-1", userId: "user-1" }],
    });
    expect(result.media).toHaveLength(1);
  });

  it("clears media when empty array provided", async () => {
    vi.mocked(prisma.post.findUnique)
      .mockResolvedValueOnce({ ...basePost, channel: { ownerId: "user-1" } } as any)
      .mockResolvedValueOnce({ ...basePost, media: [], channel: { ownerId: "user-1" } } as any);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });

    const result = await updatePost("post-1", "user-1", { media: [] });

    expect(prisma.media.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(prisma.media.createMany).not.toHaveBeenCalled();
    expect(result.media).toHaveLength(0);
  });
});
