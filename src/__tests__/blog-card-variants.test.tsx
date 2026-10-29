import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { BlogPost } from "@/types/blog";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key, useLocale: () => "en" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/BlogPostActions", () => ({ default: () => null }));
vi.mock("@/components/BlogExcerpt", () => ({ default: () => <p>Article summary</p> }));

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
    expect(root).toHaveClass("border-b", "rounded-none", "article-row");
    // The shared responsive grid places the landscape cover before the copy.
    expect(screen.getByRole("heading", { name: "A title" })).toBeInTheDocument();
    expect(container.querySelector("img")?.parentElement).toHaveClass("article-row-media");
    expect(root.firstElementChild).toContainElement(container.querySelector("img"));
  });

  it("keeps the cover-on-top layout for the editorial variant", () => {
    const { container } = render(<BlogCard post={post} variant="editorial" />);
    expect(container.querySelector("img")).toHaveClass("w-full");
  });

  it("uses the same editorial anatomy for featured list rows", () => {
    const { container } = render(<BlogCard post={post} variant="list" featured />);
    expect(container.firstElementChild).toHaveClass("article-row");
    expect(container.querySelector("img")?.parentElement).toHaveClass("article-row-media");
  });

  it("uses the shared article renderer for compact sidebar links without management controls", () => {
    const { container } = render(<BlogCard post={post} variant="compact" />);
    expect(container.querySelector("article")).toHaveClass("article-recommendation");
    expect(screen.getByRole("heading", { level: 3, name: "A title" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /A title/ })).toHaveAttribute("href", "/blog/abc12345/a-title");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: /A title/ })).toBeVisible();
  });

  it("offers a clearly named reading link from list rows", () => {
    render(<BlogCard post={post} variant="list" />);
    expect(screen.getByRole("link", { name: /readArticle: A title/ })).toHaveAttribute("href", "/blog/abc12345/a-title");
  });

  it.each(["default", "editorial", "list"] as const)("omits missing covers in the %s variant", (variant) => {
    const { container } = render(<BlogCard post={{ ...post, coverUrl: null }} variant={variant} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".article-row-media")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-has-cover", "false");
    expect(screen.getByRole("heading", { name: "A title" })).toBeVisible();
    expect(screen.getByText("Article summary")).toBeVisible();
  });

  it("removes broken covers and shows a new author cover after editing", () => {
    const { container, rerender } = render(<BlogCard post={post} variant="list" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-has-cover", "false");
    rerender(<BlogCard post={{ ...post, coverUrl: "/new-cover.jpg" }} variant="list" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/new-cover.jpg");
    expect(container.firstElementChild).toHaveAttribute("data-has-cover", "true");
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
