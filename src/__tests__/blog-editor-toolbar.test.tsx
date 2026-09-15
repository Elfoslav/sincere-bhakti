import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observerCallback: ObserverCallback | null = null;

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

import BlogEditor from "@/components/BlogEditor";

describe("BlogEditor toolbar", () => {
  beforeEach(() => {
    observerCallback = null;
    globalThis.IntersectionObserver = MockIntersectionObserver as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).IntersectionObserver;
  });

  it("sticks to the top with an opaque surface and rounds only when not stuck", async () => {
    render(<BlogEditor onChange={() => {}} />);

    const toolbar = await screen.findByRole("toolbar");
    await waitFor(() => expect(observerCallback).not.toBeNull());

    const classes = () => toolbar.className.split(/\s+/);
    expect(classes()).toContain("sticky");
    expect(classes()).toContain("top-0");
    expect(classes()).toContain("z-10");
    // Opaque, or scrolled body text would show through underneath.
    expect(classes()).toContain("bg-white");
    // At rest the top follows the box radius.
    expect(classes()).toContain("rounded-t-lg");

    // Scrolled (stuck): square top so no background wedges appear above.
    act(() => {
      observerCallback?.([{ isIntersecting: false }]);
    });
    expect(classes()).toContain("sticky");
    expect(classes()).toContain("top-0");
    expect(classes()).not.toContain("rounded-t-lg");

    // Back at rest: rounded again.
    act(() => {
      observerCallback?.([{ isIntersecting: true }]);
    });
    expect(classes()).toContain("rounded-t-lg");

    // The editor box itself must not clip overflow: overflow-hidden would
    // trap position:sticky and the bar could never engage on scroll.
    const boxClasses = (toolbar.parentElement?.className ?? "").split(/\s+/);
    expect(boxClasses.some((c) => c.startsWith("overflow-"))).toBe(false);
  });
});
