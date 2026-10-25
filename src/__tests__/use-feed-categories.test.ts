import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeedCategoriesCache, useFeedCategories } from "@/lib/hooks/useFeedCategories";

const bhakti = { id: "c1", name: "Bhakti", slug: "bhakti", language: "en" };

describe("useFeedCategories", () => {
  beforeEach(() => {
    clearFeedCategoriesCache();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ categories: [bhakti] }) });
  });

  it("loads the language's categories", async () => {
    const { result } = renderHook(() => useFeedCategories("en"));
    await waitFor(() => expect(result.current).toEqual([bhakti]));
    expect((global.fetch as any).mock.calls[0][0]).toContain("language=en");
  });

  it("reuses the cached list instead of refetching", async () => {
    const first = renderHook(() => useFeedCategories("en"));
    await waitFor(() => expect(first.result.current).toHaveLength(1));
    const second = renderHook(() => useFeedCategories("en"));
    expect(second.result.current).toEqual([bhakti]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("stays empty when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useFeedCategories("cs"));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toEqual([]);
  });
});
