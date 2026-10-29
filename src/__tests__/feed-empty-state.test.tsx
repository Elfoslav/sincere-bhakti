vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { query: string; name?: string }) => (params ? `${key}:${params.query}${params.name ? `:${params.name}` : ""}` : key),
}));

import FeedEmptyState from "@/components/FeedEmptyState";

describe("FeedEmptyState", () => {
  it("clears an unsuccessful search without leaving the current feed", () => {
    const clear = vi.fn();
    render(<FeedEmptyState search="krishna" onClearSearch={clear} />);
    fireEvent.click(screen.getByRole("button", { name: "clearSearch" }));
    expect(clear).toHaveBeenCalledOnce();
  });

  it("explains an empty category and offers its unfiltered feed", () => {
    render(<FeedEmptyState category="Kirtan" clearCategoryHref="/posts" message="Generic empty" />);
    expect(screen.getByRole("status")).toHaveTextContent("emptyCategory::Kirtan");
    expect(screen.getByRole("link", { name: "clearFilter" })).toHaveAttribute("href", "/posts");
    expect(screen.queryByText("Generic empty")).not.toBeInTheDocument();
  });

  it("identifies both the category and query when they have no matches", () => {
    render(<FeedEmptyState category="Kirtan" search="krishna" clearCategoryHref="/blog" />);
    expect(screen.getByRole("status")).toHaveTextContent("noResultsInCategory:krishna:Kirtan");
  });

  it("keeps failures distinct from empty filters", () => {
    const retry = vi.fn();
    render(<FeedEmptyState error onRetry={retry} category="Kirtan" search="krishna" clearCategoryHref="/blog" />);
    expect(screen.getByRole("alert")).toHaveTextContent("feedLoadError");
    expect(screen.queryByRole("link", { name: "clearFilter" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("announces failures and retries rather than claiming no results", () => {
    const retry = vi.fn();
    render(<FeedEmptyState error onRetry={retry} search="krishna" />);
    expect(screen.getByRole("alert")).toHaveTextContent("feedLoadError");
    expect(screen.queryByText("noResults:krishna")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("shows the supplied message when there is no search", () => {
    render(<FeedEmptyState message="Nothing yet" />);
    expect(screen.getByRole("status")).toHaveTextContent("Nothing yet");
  });

  it("explains that nothing matched while a search is active", () => {
    render(<FeedEmptyState search="krishna" message="Nothing yet" />);
    expect(screen.getByRole("status")).toHaveTextContent("noResults:krishna");
    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument();
  });

  it("omits the icon for the compact variant without a search", () => {
    const { container } = render(<FeedEmptyState compact message="Nothing yet" />);
    expect(container.textContent).not.toContain("📿");
  });
});
