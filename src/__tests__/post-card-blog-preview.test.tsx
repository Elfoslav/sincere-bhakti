import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import PostCard from "@/components/PostCard";
import type { Post } from "@/types/post";
import type { BlogPost } from "@/types/blog";

function makeBlogPost(coverUrl: string | null): BlogPost {
  return {
    id: "blog-1",
    shortId: "mockblog",
    slug: "mock-article",
    title: "Mock Article",
    excerpt: "Summary",
    content: "Body",
    contentHtml: null,
    coverUrl,
    isPublic: true,
    language: "en",
    publishedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    channel: { id: "channel-1", name: "Channel", slug: "channel", avatarUrl: null, ownerId: "user-1" },
  };
}

function makePost(blogPost: BlogPost): Post {
  return {
    id: "post-1",
    shortId: "mockpost",
    slug: null,
    content: null,
    media: [],
    isPublic: true,
    language: "en",
    createdAt: "2026-09-01T00:00:00.000Z",
    channel: { id: "channel-1", name: "Channel", slug: "channel", avatarUrl: null, ownerId: "user-1" },
    blogPost,
  };
}

function promoTextDiv(): HTMLElement {
  const promo = document.querySelector('a[href^="/blog/"]') as HTMLElement;
  expect(promo).toBeInTheDocument();
  return promo.lastElementChild as HTMLElement;
}

describe("PostCard blog preview", () => {
  it("keeps text padding when the article has a cover", () => {
    render(<PostCard post={makePost(makeBlogPost("https://media.sincerebhakti.com/covers/mock.jpg"))} />);
    expect(screen.getByText("Mock Article")).toBeInTheDocument();
    expect(promoTextDiv().className).toContain("px-3");
  });

  it("keeps left padding when the article has no cover image", () => {
    const { container } = render(<PostCard post={makePost(makeBlogPost(null))} />);
    expect(container.querySelector('a[href^="/blog/"] img')).toBeNull();
    expect(promoTextDiv().className).toContain("px-3");
  });
});
