import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn(), getTranslations: async () => (key: string) => key }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("not-found"); }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/HomepageBlogSection", () => ({ default: () => <section>Real articles</section> }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: ComponentProps<"a">) => <a href={href}>{children}</a> }));

vi.spyOn(console, "error").mockImplementation(() => {});

import Home from "@/app/[locale]/page";
import { checkRateLimit } from "@/lib/rate-limit";

describe("Home", () => {
  it("retains translated content and real join/read navigation", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(true);
    render(await Home({ params: Promise.resolve({ locale: "sk" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("logoAlt");
    expect(screen.getByRole("link", { name: "ctaJoin" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "ctaPosts" })).toHaveAttribute("href", "/posts");
    expect(screen.getByText("Real articles")).toBeInTheDocument();
  });
  it("enforces the shared SSR rate limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    await expect(Home({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow("not-found");
  });
});
