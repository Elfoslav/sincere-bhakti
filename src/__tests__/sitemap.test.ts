import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/url", () => ({
  getSiteUrl: () => "https://example.test",
}));

describe("sitemap", () => {
  it("uses latest public post dates for channel and profile lastModified values", async () => {
    const ownerCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const firstChannelLatestPostAt = new Date("2026-07-01T00:00:00.000Z");
    const secondChannelLatestPostAt = new Date("2026-07-10T00:00:00.000Z");

    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        slug: "first-channel",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        owner: { id: "user-1", createdAt: ownerCreatedAt },
        posts: [{ createdAt: firstChannelLatestPostAt }],
      },
      {
        slug: "second-channel",
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        owner: { id: "user-1", createdAt: ownerCreatedAt },
        posts: [{ createdAt: secondChannelLatestPostAt }],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.channel.findMany>>);
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: "post-1", language: "en", createdAt: firstChannelLatestPostAt },
    ] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const entries = await sitemap();

    expect(entries.find((entry) => entry.url === "https://example.test/channels/first-channel")?.lastModified).toBe(firstChannelLatestPostAt);
    expect(entries.find((entry) => entry.url === "https://example.test/channels/second-channel")?.lastModified).toBe(secondChannelLatestPostAt);
    expect(entries.find((entry) => entry.url === "https://example.test/profile/user-1")?.lastModified).toBe(secondChannelLatestPostAt);
  });
});
