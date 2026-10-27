import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { channel: { findMany: vi.fn() }, $queryRaw: vi.fn() } }));
vi.mock("@/lib/services/feed-scope", () => ({ publicVisibilityFilter: (now: Date) => ({ isPublic: true, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] }) }));
import { prisma } from "@/lib/prisma";
import { getChannelDirectory } from "@/lib/services/channel-directory";

const channel = (id: string) => ({ id, ownerId: "owner", isPersonal: false, avatarUrl: null, createdAt: new Date(), _count: { posts: 1 }, translations: [{ language: "en", name: id, slug: id }, { language: "cs", name: "Český", slug: "cesky" }], posts: [{ content: "Public reflection", createdAt: new Date("2026-10-20T09:00:00Z"), blogPost: null }] });
describe("getChannelDirectory", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns the requested translation, available languages and a safe public preview", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([channel("a")] as never);
    const result = await getChannelDirectory({ language: "cs" });
    expect(result.items[0]).toMatchObject({ name: "Český", languages: ["en", "cs"], latestPostPreview: "Public reflection" });
    const args = vi.mocked(prisma.channel.findMany).mock.calls[0][0]!;
    expect(args).toMatchObject({ where: { translations: { some: { language: "cs" } } }, take: 21, select: { posts: { take: 1, where: { language: "cs", isPublic: true, OR: expect.any(Array) } }, _count: { select: { posts: { where: { language: "cs", isPublic: true, OR: expect.any(Array) } } } } } });
  });
  it.each([
    { isPublic: false, publishedAt: null },
    { isPublic: true, publishedAt: new Date("2999-01-01") },
  ])("never exposes a private or scheduled linked article title ($isPublic, $publishedAt)", async (visibility) => {
    const row = channel("public-promo");
    const record = { ...row, posts: [{ ...row.posts[0], content: null, blogPost: { title: "Hidden title", ...visibility } }] };
    vi.mocked(prisma.channel.findMany).mockResolvedValue([record] as never);
    const result = await getChannelDirectory({ language: "en" });
    expect(result.items[0].latestPostPreview).toBe("");
    expect(JSON.stringify(result)).not.toContain("Hidden title");
  });
  it("uses a lookahead so the last page does not offer an empty extra page", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue(Array.from({ length: 21 }, (_, i) => channel(String(i))) as never);
    const page = await getChannelDirectory({ language: "en", cursor: "old", query: "reflections" });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe("19");
    expect(prisma.channel.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "old" }, skip: 1 }));
    vi.mocked(prisma.channel.findMany).mockResolvedValue([channel("last")] as never);
    expect((await getChannelDirectory({ language: "en" })).nextCursor).toBeNull();
  });
  it("ranks recent activity with bound values and excludes private/future activity", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "b" }, { id: "a" }]);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([channel("a"), channel("b")] as never);
    const result = await getChannelDirectory({ language: "en", sort: "active", cursor: "cursor", query: "name' OR true" });
    expect(result.items.map((item) => item.id)).toEqual(["b", "a"]);
    const query = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as { strings: string[]; values: unknown[] };
    const sql = query.strings.join("?");
    expect(sql).toContain('p."isPublic" = true');
    expect(sql).toContain('p."publishedAt" <= NOW()');
    expect(sql).toContain('p.language =');
    expect(sql).not.toContain("name' OR true");
    expect(query.values).toContain("cursor");
  });
});
