import type { ComponentProps, ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ pathname: "/posts/category/kirtan", status: "unauthenticated" }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: navigation.status }), signOut: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => navigation.pathname,
  Link: ({ href, children, onClick, ...props }: ComponentProps<"a"> & { children: ReactNode }) => <a href={href} {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }}>{children}</a>,
}));
vi.mock("@/components/BrandLogo", () => ({ default: () => <span>Logo</span> }));
vi.mock("@/components/LanguageSwitcher", () => ({ default: () => <button>Language</button> }));
vi.mock("@/components/IdentitySwitcher", () => ({ default: () => null }));

import Navbar from "@/components/Navbar";

describe("Navbar", () => {
  beforeEach(() => {
    navigation.pathname = "/posts/category/kirtan";
    navigation.status = "unauthenticated";
  });

  it("marks the current section on nested routes", () => {
    render(<Navbar />);
    expect(screen.getAllByRole("link", { name: "posts" })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "blog" })[0]).not.toHaveAttribute("aria-current");
  });

  it("keeps the collapsed mobile menu inert and closes it after navigation", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "toggleMenu" });
    const mobileLink = screen.getAllByRole("link", { name: "posts" })[1];
    const menu = mobileLink.closest("[inert]");
    expect(menu).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(menu).not.toHaveAttribute("inert");
    fireEvent.click(mobileLink);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("inert");
  });

  it("marks profile navigation current while visiting account settings", () => {
    navigation.pathname = "/profile/settings";
    navigation.status = "authenticated";
    render(<Navbar />);
    for (const link of screen.getAllByRole("link", { name: "profile" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });
});
