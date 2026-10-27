vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { query: string }) => (params ? `${key}:${params.query}` : key),
}));

import FeedEmptyState from "@/components/FeedEmptyState";

describe("FeedEmptyState", () => {
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
