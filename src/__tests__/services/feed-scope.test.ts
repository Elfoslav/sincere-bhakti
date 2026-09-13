import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { channel: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/services/channel", () => ({
  isChannelEditor: vi.fn(() => Promise.resolve(false)),
}));

import { prisma } from "@/lib/prisma";
import { isChannelEditor } from "@/lib/services/channel";
import { resolveFeedScopeWhere, publicVisibilityFilter } from "@/lib/services/feed-scope";
import { NotFoundError, UnauthorizedError } from "@/lib/services/errors";

describe("publicVisibilityFilter", () => {
  it("matches public rows with no (or a past) publish date", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(publicVisibilityFilter(now)).toEqual({
      isPublic: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    });
  });
});

describe("resolveFeedScopeWhere", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isChannelEditor).mockResolvedValue(false);
  });

  it("resolves the public scope with an optional channel", async () => {
    const now = new Date();
    const where = await resolveFeedScopeWhere({ scope: "public", channelId: "channel-1" }, now);
    expect(where).toEqual({
      isPublic: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      channelId: "channel-1",
    });
  });

  it("rejects the private scope without a viewer", async () => {
    await expect(resolveFeedScopeWhere({ scope: "private" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects the private scope for non-members of the channel", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as never);
    await expect(
      resolveFeedScopeWhere({ scope: "private", channelId: "channel-1", currentUserId: "user-2" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("scopes the private tab to the member channel plus the drafts filter", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as never);
    const now = new Date();
    const where = await resolveFeedScopeWhere({ scope: "private", channelId: "channel-1", currentUserId: "user-1" }, now);
    expect(where).toEqual({
      channelId: "channel-1",
      AND: [{ OR: [{ isPublic: false }, { publishedAt: { gt: now } }] }],
    });
  });

  it("rejects the default scope without a viewer", async () => {
    await expect(resolveFeedScopeWhere({})).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("applies the public filter for non-members in the default scope", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as never);
    const now = new Date();
    const where = await resolveFeedScopeWhere({ channelId: "channel-1", currentUserId: "user-2" }, now);
    expect(where).toEqual({
      channelId: "channel-1",
      isPublic: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    });
  });

  it("throws NotFoundError for a missing channel in the default scope", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);
    await expect(
      resolveFeedScopeWhere({ channelId: "missing", currentUserId: "user-1" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns the owner/editor OR filter without a channel", async () => {
    const where = await resolveFeedScopeWhere({ scope: "private", currentUserId: "user-1" });
    expect(where.OR).toEqual([
      { channel: { ownerId: "user-1" } },
      { channel: { editors: { some: { userId: "user-1", role: { in: ["admin", "editor"] } } } } },
    ]);
  });
});
