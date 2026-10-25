import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const categories = vi.hoisted(() => ({
  list: [] as { id: string; name: string; slug: string; language: string }[],
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("@/lib/hooks/useFeedCategories", () => ({ useFeedCategories: () => categories.list }));

import FeedFilterBar from "@/components/FeedFilterBar";

function renderBar(props: Partial<React.ComponentProps<typeof FeedFilterBar>> = {}) {
  return render(
    <FeedFilterBar
      search=""
      onSearchChange={() => {}}
      searchPlaceholder="Search posts…"
      basePath="/posts"
      {...props}
    />,
  );
}

describe("FeedFilterBar", () => {
  beforeEach(() => {
    categories.list = [
      { id: "1", name: "Bhakti", slug: "bhakti", language: "en" },
      { id: "2", name: "Kirtan", slug: "kirtan", language: "en" },
    ];
  });

  it("exposes a labelled search landmark with a search box", () => {
    renderBar();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search posts…" })).toBeInTheDocument();
  });

  it("reports typed text", () => {
    const onSearchChange = vi.fn();
    renderBar({ onSearchChange });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "hare" } });
    expect(onSearchChange).toHaveBeenCalledWith("hare");
  });

  it("links category chips to the section's category routes", () => {
    renderBar({ basePath: "/blog" });
    expect(screen.getByRole("link", { name: "Bhakti" })).toHaveAttribute("href", "/blog/category/bhakti");
    expect(screen.getByRole("link", { name: "all" })).toHaveAttribute("href", "/blog");
  });

  it("marks All as current when no category is active", () => {
    renderBar();
    expect(screen.getByRole("link", { name: "all" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Bhakti" })).not.toHaveAttribute("aria-current");
  });

  it("marks the active category as current instead of All", () => {
    renderBar({ activeCategory: "Kirtan" });
    expect(screen.getByRole("link", { name: "Kirtan" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "all" })).not.toHaveAttribute("aria-current");
  });

  it("hides the category navigation when there are no categories", () => {
    categories.list = [];
    renderBar();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });
});
