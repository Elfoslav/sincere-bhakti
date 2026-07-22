import { describe, expect, it, vi } from "vitest";
import sitemap, { revalidate } from "@/app/sitemap";
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
  it("revalidates the database-backed sitemap periodically", () => {
    expect(revalidate).toBe(900);
  });

  it("uses latest public post dates for channel and profile lastModified values", async () => {
    const ownerCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const firstChannelLatestPostAt = new Date("2026-07-01T00:00:00.000Z");
    const secondChannelLatestPostAt = new Date("2026-07-10T00:00:00.000Z");

    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-1",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        translations: [{ language: "en", slug: "first-channel" }],
        owner: { id: "user-1", createdAt: ownerCreatedAt },
        posts: [{ createdAt: firstChannelLatestPostAt }],
      },
      {
        id: "ch-2",
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        translations: [{ language: "en", slug: "second-channel" }],
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
