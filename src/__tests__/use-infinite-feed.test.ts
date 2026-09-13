import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfiniteFeed } from "@/lib/hooks/useInfiniteFeed";

const item = (id: string) => ({ id }) as { id: string };

class MockIntersectionObserver {
  constructor(_cb: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {}
  disconnect() {}
}

describe("useInfiniteFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IntersectionObserver = MockIntersectionObserver as any;
    global.fetch = vi.fn();
  });

  it("loads the first page from the given endpoint", async () => {
    const page1 = { posts: [item("a"), item("b")], hasMore: true };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(page1),
    });

    const { result } = renderHook(() =>
      useInfiniteFeed("/api/blog-posts", { scope: "public", language: "en" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/blog-posts?"));
  });

  it("seeds state from initialData and skips the initial fetch", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ posts: [], hasMore: false }),
    });

    const { result } = renderHook(() =>
      useInfiniteFeed("/api/posts", {
        scope: "public",
        language: "en",
        initialData: { posts: [item("seed")], hasMore: false },
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.posts.map((p) => p.id)).toEqual(["seed"]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
