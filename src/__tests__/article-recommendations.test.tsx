import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/types/blog";
import { LATEST_BLOG_POSTS_LIMIT } from "@/lib/blog";
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>, useRouter: () => ({ push: vi.fn() }) }));
import ArticleRecommendations from "@/components/ArticleRecommendations";

const base: BlogPost = { id: "current", shortId: "current1", slug: "current", title: "Current article", excerpt: null, content: null, contentHtml: null, coverUrl: null, isPublic: true, publishedAt: null, language: "en", createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z", channel: { id: "c", name: "Community", slug: "community", avatarUrl: null, ownerId: "owner" }, categories: [] };
const renderGroup = (posts: BlogPost[]) => render(<ArticleRecommendations title="From this channel" posts={posts} currentPostId="current" href="/blog/channel/community" linkLabel="All channel articles" />);

describe("ArticleRecommendations", () => {
  it("hides empty groups instead of leaving a heading and empty panel", () => {
    const { container } = renderGroup([]);
    expect(container).toBeEmptyDOMElement();
  });
  it("excludes the current article, private drafts and future publications", () => {
    renderGroup([base, { ...base, id: "private", title: "Private draft", isPublic: false }, { ...base, id: "future", title: "Scheduled article", publishedAt: "2099-01-01T09:00:00Z" }, { ...base, id: "public", shortId: "public12", slug: "reflection", title: "Public reflection" }]);
    expect(screen.queryByText("Current article")).not.toBeInTheDocument();
    expect(screen.queryByText("Private draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheduled article")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Public reflection/ })).toHaveAttribute("href", "/blog/public12/reflection");
    expect(screen.getByRole("link", { name: "All channel articles" })).toHaveAttribute("href", "/blog/channel/community");
  });
  it("caps each group and retains the server's publication order", () => {
    renderGroup(Array.from({ length: LATEST_BLOG_POSTS_LIMIT + 2 }, (_, index) => ({ ...base, id: `post-${index}`, title: `Article ${index}` })));
    const region = screen.getByRole("region", { name: "From this channel" });
    expect(within(region).getAllByRole("article")).toHaveLength(LATEST_BLOG_POSTS_LIMIT);
    expect(within(region).getAllByRole("heading", { level: 3 }).map(el => el.textContent)).toEqual(["Article 0", "Article 1", "Article 2"]);
  });
});
