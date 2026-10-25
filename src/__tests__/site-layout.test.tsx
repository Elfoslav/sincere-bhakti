import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

vi.mock("next-intl", () => ({ NextIntlClientProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("next-intl/server", () => ({ getMessages: async () => ({}), getTranslations: async () => (key: string) => key, setRequestLocale: vi.fn() }));
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
