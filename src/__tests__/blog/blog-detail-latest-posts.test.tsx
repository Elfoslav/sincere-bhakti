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

import { useSession } from "next-auth/react";
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
    categories: [],
  };
}

const mainPost = makePost("main", "Main Article");

describe("BlogDetailClient editorial layout", () => {
  it("renders breadcrumb, heading title, and excerpt", () => {
    const { container } = render(
      <BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />,
    );
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
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
    expect(screen.queryByRole("region", { name: "latestPosts" })).not.toBeInTheDocument();
  });

  it("renders latest articles as a numbered list", () => {
    const { container } = render(
      <BlogDetailClient
        post={mainPost}
        contentHtml="<p>body</p>"
        latestPosts={[makePost("a", "Alpha"), makePost("b", "Beta"), makePost("c", "Gamma")]}
      />,
    );
    const section = screen.getByRole("region", { name: "latestPosts" });
    expect(within(section).getByRole("heading", { name: "moreArticles" })).toBeInTheDocument();
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

  it("shows the reading time estimate in the byline", () => {
    const words = Array.from({ length: 450 }, (_, i) => `w${i}`).join(" ");
    render(<BlogDetailClient post={mainPost} contentHtml={`<p>${words}</p>`} latestPosts={[]} />);
    expect(screen.getByText("readingTime")).toBeInTheDocument();
  });

  it("omits the reading time when there is no body", () => {
    render(<BlogDetailClient post={mainPost} contentHtml="" latestPosts={[]} />);
    expect(screen.queryByText("readingTime")).not.toBeInTheDocument();
  });

  it("renders the title and byline inside the article with a reading-progress bar", () => {
    const { container } = render(<BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />);
    const article = container.querySelector("article")!;
    expect(article.querySelector("header h1")).toHaveTextContent("Main Article");
    expect(container.querySelector("[aria-hidden='true'].fixed")).not.toBeNull();
  });

  it("uses a comfortable long-form measure and type scale", () => {
    const { container } = render(
      <BlogDetailClient post={mainPost} contentHtml="<p>body</p>" latestPosts={[]} />,
    );
    // The shared reading measure stays consistent with feeds and detail pages.
    const column = container.firstElementChild!;
    expect(column.className.split(/\s+/)).toContain("reading-container");
    expect(column.className.split(/\s+/)).not.toContain("max-w-2xl");
    // 18px body on the roomy article rhythm, constrained to a ~42rem measure;
    // the dek (excerpt) stays above it in the display font.
    const body = container.querySelector("article .rich-text")!;
    const classes = body.className.split(/\s+/);
    expect(classes).toContain("rich-text-article");
    expect(classes).toContain("text-lg");
    expect(classes).toContain("max-w-[42rem]");
    expect(screen.getByText("Excerpt Main Article").className.split(/\s+/)).toContain("text-xl");
    // An open editorial page, not a boxed card.
    expect(body.closest("div.bg-card")).toBeNull();
  });

  it("never nests a div inside a paragraph (hydration-safe)", () => {
    // As the channel owner the action buttons render — the guard below is
    // only exercised when they do.
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as any);
    try {
      const { container } = render(
        <BlogDetailClient
          post={mainPost}
          contentHtml="<p>body</p>"
          latestPosts={[makePost("a", "Alpha")]}
        />,
      );
      expect(screen.getAllByRole("button", { name: "copyLink" }).length).toBeGreaterThan(0);
      expect(container.querySelectorAll("p div")).toHaveLength(0);
    } finally {
      vi.mocked(useSession).mockReturnValue({ data: null } as any);
    }
  });
});
