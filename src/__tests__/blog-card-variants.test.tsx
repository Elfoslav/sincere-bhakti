import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { BlogPost } from "@/types/blog";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key, useLocale: () => "en" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/BlogPostActions", () => ({ default: () => null }));
vi.mock("@/components/BlogExcerpt", () => ({ default: () => null }));

import BlogCard from "@/components/BlogCard";

const post = {
  id: "b1", shortId: "abc12345", slug: "a-title", title: "A title", excerpt: null, coverUrl: "/cover.jpg",
  isPublic: true, publishedAt: null, createdAt: "2026-10-25T10:00:00Z", categories: [],
  channel: { id: "c1", name: "Channel", slug: "channel", ownerId: "o1", avatarUrl: null },
} as unknown as BlogPost;

describe("BlogCard variants", () => {
  it("renders the boxed card by default", () => {
    const { container } = render(<BlogCard post={post} />);
    expect(container.firstElementChild).toHaveClass("border", "rounded-lg");
  });

  it("renders the list variant as a divider row like the timeline posts", () => {
    const { container } = render(<BlogCard post={post} variant="list" />);
    const root = container.firstElementChild!;
    expect(root).toHaveClass("border-b", "rounded-none", "py-7");
    // The small thumbnail stays beside the text instead of a full-width cover.
    expect(screen.getByRole("heading", { name: "A title" })).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveClass("h-24");
  });

  it("keeps the cover-on-top layout for the editorial variant", () => {
    const { container } = render(<BlogCard post={post} variant="editorial" />);
    expect(container.querySelector("img")).toHaveClass("w-full");
  });

  it("puts the cover on top for the featured list row", () => {
    const { container } = render(<BlogCard post={post} variant="list" featured />);
    expect(container.querySelector("img")).toHaveClass("aspect-[2/1]", "w-full");
  });

  it("shows the reading time in the byline when the article has a body", () => {
    const words = Array.from({ length: 450 }, (_, i) => `w${i}`).join(" ");
    render(<BlogCard post={{ ...post, contentHtml: `<p>${words}</p>` }} variant="list" />);
    expect(screen.getByText("readingTime")).toBeInTheDocument();
  });

  it("hides the reading time without a body", () => {
    render(<BlogCard post={{ ...post, contentHtml: null }} variant="list" />);
    expect(screen.queryByText("readingTime")).not.toBeInTheDocument();
  });
});
