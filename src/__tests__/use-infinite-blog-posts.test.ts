import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";

const post = (id: string) => ({ id } as any);

class MockIntersectionObserver {
  constructor(_cb: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {}
  disconnect() {}
}

describe("useInfiniteBlogPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IntersectionObserver = MockIntersectionObserver as any;
    global.fetch = vi.fn();
  });

  it("loads the first page from the blog endpoint", async () => {
    const page1 = { posts: [post("a"), post("b")], hasMore: true };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(page1),
    });

    const { result } = renderHook(() =>
      useInfiniteBlogPosts({ scope: "public", language: "en" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/blog-posts?"));
  });

  it("passes scope, channel, and language filters through", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ posts: [], hasMore: false }),
    });

    renderHook(() =>
      useInfiniteBlogPosts({ scope: "public", channelId: "channel-1", language: "cs" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("scope=public");
    expect(calledUrl).toContain("channelId=channel-1");
    expect(calledUrl).toContain("language=cs");
  });
});
