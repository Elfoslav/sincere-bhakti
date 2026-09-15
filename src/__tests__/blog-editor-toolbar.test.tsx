import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import BlogEditor from "@/components/BlogEditor";

describe("BlogEditor toolbar", () => {
  it("sticks to the top with an opaque surface for long articles", async () => {
    render(<BlogEditor onChange={() => {}} />);

    const toolbar = await screen.findByRole("toolbar");
    const classes = toolbar.className.split(/\s+/);
    expect(classes).toContain("sticky");
    expect(classes).toContain("top-0");
    expect(classes).toContain("z-10");
    // Opaque, or scrolled body text would show through underneath.
    expect(classes).toContain("bg-white");
    // Square top: rounded corners would leave background wedges above the
    // stuck bar.
    expect(classes).not.toContain("rounded-t-lg");
    // The editor box itself must not clip overflow: overflow-hidden would
    // trap position:sticky and the bar could never engage on scroll.
    const boxClasses = (toolbar.parentElement?.className ?? "").split(/\s+/);
    expect(boxClasses.some((c) => c.startsWith("overflow-"))).toBe(false);
  });
});
