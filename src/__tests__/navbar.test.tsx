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
  it("dismisses with Escape and returns focus to the menu toggle", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "toggleMenu" });
    fireEvent.click(toggle);
    const link = screen.getAllByRole("link", { name: "posts" })[1];
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("dismisses on outside clicks but keeps interactions inside open", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "toggleMenu" });
    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("button", { name: "Language" })[1]);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(document.body);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("lets a nested menu handle Escape before dismissing navigation", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "toggleMenu" });
    fireEvent.click(toggle);
    const language = screen.getAllByRole("button", { name: "Language" })[1];
    language.setAttribute("aria-haspopup", "menu");
    language.setAttribute("aria-expanded", "true");
    fireEvent.keyDown(language, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    language.setAttribute("aria-expanded", "false");
    fireEvent.keyDown(language, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes navigation when the mobile sign-in link is selected", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "toggleMenu" });
    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("link", { name: "getIn" })[1]);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

});
