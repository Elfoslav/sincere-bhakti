import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
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
    categories: [],
  };
}

function makePost(blogPost: BlogPost | null): Post {
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
    blogPostId: blogPost?.id ?? null,
    publishedAt: null,
    categories: [],
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


describe("PostCard journal layout", () => {
  it("keeps text-only posts full-width and uses the real avatar", () => {
    const post = makePost(null);
    post.content = "A simple reflection.";
    post.channel.avatarUrl = "/images/avatar.jpg";
    const { container } = render(<PostCard post={post} variant="journal" />);
    expect(container.firstElementChild).toHaveClass("journal-post");
    expect(container.firstElementChild).toHaveAttribute("data-has-media", "false");
    expect(screen.getByText(post.content)).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/avatar.jpg"]')).toBeInTheDocument();
  });

  it("retains the lightbox for compact photos", () => {
    const post = makePost(null);
    post.content = "A photo reflection.";
    post.media = [{ url: "/images/article-tulsi.jpg", type: "image", width: 1200, height: 800, position: 0 }];
    const { container } = render(<PostCard post={post} variant="journal" />);
    expect(container.firstElementChild).toHaveAttribute("data-has-media", "true");
    fireEvent.click(screen.getByRole("button", { name: "openImage" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves standalone YouTube previews and media-only posts", () => {
    const post = makePost(null);
    post.content = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const { container, rerender } = render(<PostCard post={post} variant="journal" />);
    expect(container.firstElementChild).toHaveAttribute("data-has-copy", "true");
    expect(screen.getByTitle("youtubePreview")).toBeInTheDocument();
    post.content = null;
    post.media = [{ url: "/images/article-tulsi.jpg", type: "image", width: null, height: null, position: 0 }];
    rerender(<PostCard post={{ ...post }} variant="journal" />);
    expect(container.firstElementChild).toHaveAttribute("data-has-copy", "false");
    expect(screen.getByRole("button", { name: "openImage" })).toBeInTheDocument();
  });

  it("keeps editing available only for manageable posts", () => {
    const post = makePost(null);
    post.content = "An editable reflection.";
    const onEdit = vi.fn();
    const { rerender } = render(<PostCard post={post} variant="journal" currentUserId="user-1" onEdit={onEdit} />);
    fireEvent.click(screen.getAllByRole("button", { name: "editPost" })[0]);
    expect(onEdit).toHaveBeenCalledWith(post.id);
    rerender(<PostCard post={post} variant="journal" currentUserId="another-user" onEdit={onEdit} />);
    expect(screen.queryByRole("button", { name: "editPost" })).not.toBeInTheDocument();
  });
});
