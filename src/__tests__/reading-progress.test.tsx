import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadingProgress from "@/components/ReadingProgress";

function setScroll(scrollY: number, scrollHeight: number, innerHeight = 800) {
  Object.defineProperty(window, "scrollY", { value: scrollY, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: scrollHeight, configurable: true });
}

describe("ReadingProgress", () => {
  beforeEach(() => {
    // Run frames synchronously; returning 0 keeps the component's "frame
    // pending" flag clear, as it is after a real frame has fired.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const bar = (container: HTMLElement) => container.querySelector<HTMLElement>("[class*='origin-left']")!;

  it("is hidden from assistive technology", () => {
    setScroll(0, 2000);
    const { container } = render(<ReadingProgress />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("starts empty and fills as the page scrolls", () => {
    setScroll(0, 2000);
    const { container } = render(<ReadingProgress />);
    expect(bar(container).style.transform).toBe("scaleX(0)");

    setScroll(600, 2000); // 600 of the 1200px that can scroll
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(bar(container).style.transform).toBe("scaleX(0.5)");

    setScroll(1200, 2000);
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(bar(container).style.transform).toBe("scaleX(1)");
  });

  it("stays empty when the page does not scroll", () => {
    setScroll(0, 700);
    const { container } = render(<ReadingProgress />);
    expect(bar(container).style.transform).toBe("scaleX(0)");
  });

  it("removes its listeners on unmount", () => {
    setScroll(0, 2000);
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReadingProgress />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
