import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string, vars?: Record<string, string>) => {
    if (key === "filteringByChannel") return `Showing channel "${vars?.name}"`;
    if (key === "clearFilter") return "Clear filter";
    return key;
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { ChannelFilterBanner } from "@/components/CategoryFilterBanner";

describe("ChannelFilterBanner", () => {
  it("shows the active channel with a clear link", () => {
    render(<ChannelFilterBanner name="Devotees" href="/blog" />);

    expect(screen.getByText('Showing channel "Devotees"')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filter" })).toHaveAttribute("href", "/blog");
  });
});
