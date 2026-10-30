import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";

beforeEach(() => {
  window.history.replaceState({ page: "original" }, "");
  vi.spyOn(window.history, "back").mockImplementation(() => {});
});
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  vi.restoreAllMocks();
});

describe("useLightboxHistory", () => {
  it("preserves page state and URL, and creates only one entry under Strict Mode", () => {
    const push = vi.spyOn(window.history, "pushState");
    const url = location.href;
    const { rerender } = renderHook(() => useLightboxHistory(vi.fn()), { wrapper: StrictMode });
    rerender();
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toMatchObject({ page: "original", mediaLightbox: expect.any(String) });
    expect(location.href).toBe(url);
  });

  it("closes on Back without another traversal and calls the latest handler", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(({ onClose }) => useLightboxHistory(onClose), { initialProps: { onClose: first } });
    rerender({ onClose: latest });
    act(() => {
      window.history.replaceState({ page: "original" }, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(window.history.back).not.toHaveBeenCalled();
  });

  it("removes the entry exactly once on explicit close, including unmount", async () => {
    const onClose = vi.fn();
    const { result, unmount } = renderHook(() => useLightboxHistory(onClose));
    act(() => { result.current(); result.current(); });
    unmount();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.history.back).toHaveBeenCalledOnce();
  });

  it("removes its entry once on unexpected unmount, including Strict Mode cleanup", async () => {
    const { unmount } = renderHook(() => useLightboxHistory(vi.fn()), { wrapper: StrictMode });
    unmount();
    await Promise.resolve();
    expect(window.history.back).toHaveBeenCalledOnce();
  });

  it("cleans up when unmounted, without navigating back after a route change", async () => {
    const { unmount } = renderHook(() => useLightboxHistory(vi.fn()));
    window.history.replaceState({}, "");
    unmount();
    await Promise.resolve();
    expect(window.history.back).not.toHaveBeenCalled();
  });
});
