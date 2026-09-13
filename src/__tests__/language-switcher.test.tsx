import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
}));

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: vi.fn(() => "/posts"),
  useRouter: vi.fn(() => ({ replace })),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import LanguageSwitcher from "@/components/LanguageSwitcher";

const RECT = {
  top: 100,
  bottom: 140,
  left: 50,
  right: 150,
  width: 100,
  height: 40,
  x: 50,
  y: 100,
  toJSON: () => ({}),
} as DOMRect;

const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect;

afterEach(() => {
  window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  vi.clearAllMocks();
});

function mockRect() {
  window.HTMLElement.prototype.getBoundingClientRect = vi.fn(() => RECT);
}

function getDropdown(container: HTMLElement): HTMLElement | null {
  return container.querySelector("div.fixed");
}

describe("LanguageSwitcher", () => {
  it("positions the dropdown under the button on first open", () => {
    mockRect();
    const { container } = render(<LanguageSwitcher />);

    expect(getDropdown(container)).toBeNull();

    fireEvent.click(screen.getByRole("button"));

    const dropdown = getDropdown(container);
    expect(dropdown).not.toBeNull();
    // Button bottom (140) + 4px gap, aligned to the button's left edge,
    // at least 128px wide — never the initial (0, 0) position.
    expect(dropdown!.style.top).toBe("144px");
    expect(dropdown!.style.left).toBe("50px");
    expect(dropdown!.style.minWidth).toBe("128px");
  });

  it("toggles closed on a second click", () => {
    mockRect();
    const { container } = render(<LanguageSwitcher />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(getDropdown(container)).not.toBeNull();

    fireEvent.click(button);
    expect(getDropdown(container)).toBeNull();
  });

  it("switches locale when a language is picked", () => {
    mockRect();
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /CS/ }));

    expect(replace).toHaveBeenCalledWith("/posts", { locale: "cs" });
  });
});
