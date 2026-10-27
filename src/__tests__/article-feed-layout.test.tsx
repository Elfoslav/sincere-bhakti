import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/hooks/useFeedCategories", () => ({ useFeedCategories: () => [] }));

import ArticleFeedLayout from "@/components/ArticleFeedLayout";

describe("ArticleFeedLayout", () => {
  it("shares the heading, search, editorial categories and guest context", () => {
    const change = vi.fn();
    const { container } = render(<ArticleFeedLayout search="" onSearchChange={change} categories={[{ id: "1", name: "Practice", slug: "practice", language: "en" }]}><p>Article content</p></ArticleFeedLayout>);
    expect(container.firstElementChild).toHaveClass("article-feed-container");
    expect(screen.getByRole("heading", { level: 1, name: "title" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/blog/category/practice");
    expect(screen.getByText(/newHere/)).toHaveTextContent("newHere signIn joinSanga");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bhakti" } });
    expect(change).toHaveBeenCalledWith("bhakti");
    expect(screen.getByText("Article content")).toBeInTheDocument();
  });

  it("shows publishing tools for signed-in users without the guest prompt", () => {
    render(<ArticleFeedLayout search="" onSearchChange={() => {}} authenticated tools={<button>Publish</button>}>Articles</ArticleFeedLayout>);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "signIn" })).not.toBeInTheDocument();
  });
});
