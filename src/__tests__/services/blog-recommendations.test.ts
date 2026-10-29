import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/services/blog", () => ({ getBlogPosts: vi.fn() }));
vi.spyOn(console, "error").mockImplementation(() => {});
import { getBlogPosts } from "@/lib/services/blog";
import { getBlogRecommendations } from "@/lib/services/blog-recommendations";
import { LATEST_BLOG_POSTS_LIMIT } from "@/lib/blog";

const post = { id: "current", channel: { id: "channel", name: "Channel", slug: "channel", ownerId: "owner", avatarUrl: null } };
beforeEach(() => { vi.mocked(getBlogPosts).mockReset(); });
describe("getBlogRecommendations", () => {
  it("bounds both groups, excludes the current article, and uses public content in the browsing language", async () => {
    vi.mocked(getBlogPosts).mockResolvedValue({ posts: [], hasMore: false });
    await getBlogRecommendations(post, "cs");
    const shared = { scope: "public", language: "cs", requestLanguage: "cs", limit: LATEST_BLOG_POSTS_LIMIT, excludePostId: "current", includeContentHtml: false };
    expect(getBlogPosts).toHaveBeenNthCalledWith(1, { ...shared, channelId: "channel" });
    expect(getBlogPosts).toHaveBeenNthCalledWith(2, { ...shared, excludeChannelId: "channel" });
  });
  it("preserves the other group if one query fails", async () => {
    const other = { id: "other" } as Awaited<ReturnType<typeof getBlogPosts>>["posts"][number];
    vi.mocked(getBlogPosts).mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce({ posts: [other], hasMore: false });
    expect(await getBlogRecommendations(post, "en")).toEqual({ channelPosts: [], otherPosts: [other] });
  });
  it("returns empty recommendations when discovery is unavailable", async () => {
    vi.mocked(getBlogPosts).mockRejectedValue(new Error("unavailable"));
    expect(await getBlogRecommendations(post, "sk")).toEqual({ channelPosts: [], otherPosts: [] });
  });
});
