import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

vi.mock("next-intl", () => ({ NextIntlClientProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("next-intl/server", () => ({ getMessages: async () => ({}), getTranslations: async () => Object.assign((key: string) => key, { rich: (key: string, values: { lotus: () => ReactNode }) => <>{key}{values.lotus()}</> }), setRequestLocale: vi.fn() }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav aria-label="Site navigation" /> }));
vi.mock("@/components/LangSetter", () => ({ default: () => null }));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));

import SiteLayout from "@/components/SiteLayout";
import { setRequestLocale } from "next-intl/server";

it("provides the same navigation, content landmark, and legal footer for its children", async () => {
  render(await SiteLayout({ locale: "cs", children: <p>Page content</p> }));
  expect(setRequestLocale).toHaveBeenCalledWith("cs");
  expect(screen.getByRole("navigation", { name: "Site navigation" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveTextContent("Page content");
  expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
  expect(screen.getByRole("link", { name: "privacy" }).closest("footer")).not.toBeNull();
});

it("offers a skip link as the first tab stop that targets the focusable main landmark", async () => {
  const { container } = render(await SiteLayout({ locale: "en", children: <p>Page content</p> }));
  const skip = screen.getByRole("link", { name: "skipToContent" });
  expect(skip).toHaveAttribute("href", "#main-content");
  expect(container.querySelector("a, button, [tabindex]")).toBe(skip);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main-content");
  expect(main).toHaveAttribute("tabindex", "-1");
});

it("underlines footer links so they do not rely on color alone", async () => {
  render(await SiteLayout({ locale: "en", children: null }));
  expect(screen.getByRole("link", { name: "terms" }).className).toContain("underline");
  expect(screen.getByRole("link", { name: "privacy" }).className).toContain("underline");
});
