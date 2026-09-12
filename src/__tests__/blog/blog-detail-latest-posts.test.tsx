import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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

describe("BlogDetailClient editorial layout", () => {
  it("renders breadcrumb, serif title, and excerpt", () => {
    const { container } = render(
      <BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Main Article" })).toBeInTheDocument();
    expect(screen.getByText("Excerpt Main Article")).toBeInTheDocument();
    expect(container.querySelector("figure")).not.toBeInTheDocument();
  });

  it("renders no cover figure when the article has no cover image", () => {
    const { container } = render(
      <BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />,
    );
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the cover figure when the article has a cover image", () => {
    const { container } = render(
      <BlogDetailClient
        post={{ ...mainPost, coverUrl: "https://media.sincerebhakti.com/covers/mock.jpg" }}
        contentHtml="<p>body</p>"
        latestPosts={[]}
      />,
    );
    const figure = container.querySelector("figure");
    expect(figure).toBeInTheDocument();
    expect(figure?.querySelector("img")).toHaveAttribute(
      "src",
      "https://media.sincerebhakti.com/covers/mock.jpg",
    );
  });

  it("renders no latest section when there are no other articles", () => {
    render(<BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />);
    expect(screen.queryByText("latestPosts")).not.toBeInTheDocument();
  });

  it("renders latest articles as a numbered list", () => {
    const { container } = render(
      <BlogDetailClient
        post={mainPost}
        contentHtml="<p>body</p>"
        latestPosts={[makePost("a", "Alpha"), makePost("b", "Beta"), makePost("c", "Gamma")]}
      />,
    );
    const section = screen.getByText("latestPosts").closest("section")!;
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("01");
    expect(items[1]).toHaveTextContent("02");
    expect(items[2]).toHaveTextContent("03");
    for (const title of ["Alpha", "Beta", "Gamma"]) {
      expect(within(section).getByText(title)).toBeInTheDocument();
    }
    expect(container.querySelector("section div.grid")).toBeNull();
  });
});
