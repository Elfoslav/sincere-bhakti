import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";

const post = (id: string) => ({ id } as any);

let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

class MockIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    observerCallback = cb;
  }
  observe() {}
  disconnect() {}
}

describe("useInfinitePosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    globalThis.IntersectionObserver = MockIntersectionObserver as any;
    global.fetch = vi.fn();
  });

  it("loads the first page on mount", async () => {
    const page1 = { posts: [post("a"), post("b")], hasMore: true };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(page1),
    });

    const { result } = renderHook(() =>
      useInfinitePosts({ scope: "public", language: "en" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);
  });

  it("does not duplicate posts when the observer fires loadMore concurrently", async () => {
    const page1 = { posts: [post("a"), post("b")], hasMore: true };
    const page2 = { posts: [post("c"), post("d")], hasMore: false };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2),
      });
    global.fetch = fetchMock;

    const { result } = renderHook(() =>
      useInfinitePosts({ scope: "public", language: "en" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b"]);

    // Register the sentinel observer, then fire the intersection callback twice
    // in the same tick. The second fire must be dropped (ref guard), so the
    // cursor page is fetched exactly once.
    act(() => {
      result.current.sentinelRef({} as any);
    });
    await act(async () => {
      observerCallback?.([{ isIntersecting: true }]);
      observerCallback?.([{ isIntersecting: true }]);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("dedupes appended posts by id even if the API returns an overlap", async () => {
    const page1 = { posts: [post("a"), post("b")], hasMore: true };
    const page2 = { posts: [post("b"), post("c")], hasMore: false };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2),
      });
    global.fetch = fetchMock;

    const { result } = renderHook(() =>
      useInfinitePosts({ scope: "public", language: "en" }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b"]);

    await act(async () => {
      result.current.sentinelRef({} as any);
    });
    await act(async () => {
      observerCallback?.([{ isIntersecting: true }]);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.posts.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
