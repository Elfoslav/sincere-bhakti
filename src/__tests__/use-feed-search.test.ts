import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedSearch } from "@/lib/hooks/useFeedSearch";

describe("useFeedSearch", () => {
  beforeEach(() => { window.history.replaceState({}, "", "/blog?category=bhakti"); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); window.history.replaceState({}, "", "/"); });
  it("restores a shared query and debounces API search while preserving other parameters", () => {
    window.history.replaceState({}, "", "/blog?q=holy+name&category=bhakti");
    const { result } = renderHook(() => useFeedSearch());
    expect(result.current.searchInput).toBe("holy name");
    act(() => result.current.setSearchInput("Krishna"));
    expect(result.current.searchInput).toBe("Krishna");
    expect(result.current.search).toBe("holy name");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.search).toBe("Krishna");
    expect(new URLSearchParams(location.search).get("q")).toBe("Krishna");
    expect(location.search).toContain("category=bhakti");
  });
  it("restores browser navigation and removes only q when clearing", () => {
    const { result } = renderHook(() => useFeedSearch());
    act(() => { window.history.pushState({}, "", "/blog?q=back&category=bhakti"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(result.current.searchInput).toBe("back");
    act(() => result.current.clearSearch());
    expect(result.current.searchInput).toBe("");
    expect(location.search).toBe("?category=bhakti");
  });
});
