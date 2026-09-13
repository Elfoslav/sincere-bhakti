import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string, vars?: Record<string, string>) => {
    if (key === "filteringByCategory") return `Showing category "${vars?.name}"`;
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

import CategoryChips from "@/components/CategoryChips";
import CategoryFilterBanner from "@/components/CategoryFilterBanner";

const categories = [
  { id: "c1", name: "BHAKTI", slug: "bhakti", language: "en" },
  { id: "c2", name: "HOLY NAME", slug: "holy-name", language: "en" },
];

describe("CategoryChips", () => {
  it("renders nothing without categories", () => {
    const { container } = render(<CategoryChips categories={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders names as static text without a handler", () => {
    render(<CategoryChips categories={categories} />);
    expect(screen.getByText("BHAKTI")).toBeInTheDocument();
    expect(screen.getByText("HOLY NAME")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("notifies the parent when a chip is selected", () => {
    const onSelect = vi.fn();
    render(<CategoryChips categories={categories} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "HOLY NAME" }));
    expect(onSelect).toHaveBeenCalledWith({ id: "c2", name: "HOLY NAME", slug: "holy-name", language: "en" });
  });
});

describe("CategoryFilterBanner", () => {
  it("shows the active category with a clear link", () => {
    render(<CategoryFilterBanner name="BHAKTI" href="/posts" />);

    expect(screen.getByText('Showing category "BHAKTI"')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filter" })).toHaveAttribute("href", "/posts");
  });
});
