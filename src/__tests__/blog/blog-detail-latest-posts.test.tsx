import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

vi.mock("@/components/IdentityProvider", () => ({
  useIdentity: vi.fn(() => ({ identities: [], activeChannelId: null })),
}));

vi.mock("@/components/EditBlogModal", () => ({
  default: () => null,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import BlogDetailClient from "@/app/[locale]/blog/[shortId]/blog-detail-client";
import type { BlogPost } from "@/types/blog";

function makePost(id: string, title: string): BlogPost {
  return {
    id,
    shortId: `short-${id}`,
    slug: `slug-${id}`,
    title,
    excerpt: `Excerpt ${title}`,
    content: "Body",
    contentHtml: null,
    coverUrl: null,
    isPublic: true,
    language: "en",
    publishedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    channel: { id: "channel-1", name: "Channel", slug: "channel", avatarUrl: null, ownerId: "user-1" },
  };
}

const mainPost = makePost("main", "Main Article");

describe("BlogDetailClient latest posts", () => {
  it("renders no latest section when there are no other articles", () => {
    render(<BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />);
    expect(screen.queryByText("latestPosts")).not.toBeInTheDocument();
  });

  it("renders a single latest article full width", () => {
    const { container } = render(
      <BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[makePost("a", "Alpha")]} />,
    );
    expect(screen.getByText("latestPosts")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    const grid = container.querySelector("section div.grid");
    expect(grid?.className).toBe("grid grid-cols-1 gap-4");
  });

  it("renders two latest articles in two columns", () => {
    const { container } = render(
      <BlogDetailClient
        post={mainPost}
        contentHtml="<p>body</p>"
        latestPosts={[makePost("a", "Alpha"), makePost("b", "Beta")]}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    const grid = container.querySelector("section div.grid");
    expect(grid?.className).toBe("grid grid-cols-1 gap-4 sm:grid-cols-2");
  });

  it("renders three latest articles in three columns", () => {
    const { container } = render(
      <BlogDetailClient
        post={mainPost}
        contentHtml="<p>body</p>"
        latestPosts={[makePost("a", "Alpha"), makePost("b", "Beta"), makePost("c", "Gamma")]}
      />,
    );
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    const grid = container.querySelector("section div.grid");
    expect(grid?.className).toBe("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3");
  });
});
