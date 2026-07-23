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

  it("uses latest public post dates for channel lastModified values", async () => {
    const firstChannelLatestPostAt = new Date("2026-07-01T00:00:00.000Z");
    const secondChannelLatestPostAt = new Date("2026-07-10T00:00:00.000Z");

    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-1",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        translations: [{ language: "en", slug: "first-channel" }],
        posts: [{ createdAt: firstChannelLatestPostAt }],
      },
      {
        id: "ch-2",
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        translations: [{ language: "en", slug: "second-channel" }],
        posts: [{ createdAt: secondChannelLatestPostAt }],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.channel.findMany>>);
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: "post-1", language: "en", createdAt: firstChannelLatestPostAt },
    ] as Awaited<ReturnType<typeof prisma.post.findMany>>);

    const entries = await sitemap();

    expect(entries.find((entry) => entry.url === "https://example.test/channels/first-channel")?.lastModified).toBe(firstChannelLatestPostAt);
    expect(entries.find((entry) => entry.url === "https://example.test/channels/second-channel")?.lastModified).toBe(secondChannelLatestPostAt);
  });

  it("emits one sitemap entry per translation per channel", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-1",
        createdAt: new Date("2026-01-01"),
        translations: [
          { language: "en", slug: "my-channel" },
          { language: "cs", slug: "muj-kanal" },
          { language: "sk", slug: "moj-kanal" },
        ],
        posts: [{ createdAt: new Date("2026-06-01") }],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.channel.findMany>>);
    vi.mocked(prisma.post.findMany).mockResolvedValue([] as any);

    const entries = await sitemap();
    const channelUrls = entries
      .filter((e) => e.url.includes("/channels/"))
      .map((e) => e.url);

    expect(channelUrls).toContain("https://example.test/channels/my-channel");
    expect(channelUrls).toContain("https://example.test/cs/channels/muj-kanal");
    expect(channelUrls).toContain("https://example.test/sk/channels/moj-kanal");
    expect(channelUrls).toHaveLength(3);
  });
});
