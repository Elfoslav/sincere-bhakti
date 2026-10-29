import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BlogPost } from "@/types/blog";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key, useLocale: () => "sk" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/lib/hooks/useInfiniteBlogPosts", () => ({ useInfiniteBlogPosts: vi.fn() }));
vi.mock("@/components/BlogCard", () => ({ default: ({ post, featured }: { post: BlogPost; featured: boolean }) => <article data-featured={featured}>{post.title}</article> }));

import HomepageBlogSection from "@/components/HomepageBlogSection";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";

describe("HomepageBlogSection", () => {
  it("reserves article rows while loading and keeps the heading when content arrives", () => {
    vi.mocked(useInfiniteBlogPosts).mockReturnValue({ posts: [], loading: true } as unknown as ReturnType<typeof useInfiniteBlogPosts>);
    const { container, rerender } = render(<HomepageBlogSection />);
    expect(screen.getByRole("status")).toHaveTextContent("loadingArticles");
    expect(container.querySelectorAll(".article-row")).toHaveLength(3);
    const heading = screen.getByRole("heading", { name: "blogLatestTitle" });
    vi.mocked(useInfiniteBlogPosts).mockReturnValue({ posts: [{ id: "1", title: "Loaded article" }], loading: false } as ReturnType<typeof useInfiniteBlogPosts>);
    rerender(<HomepageBlogSection />);
    expect(screen.getByRole("heading", { name: "blogLatestTitle" })).toBe(heading);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Loaded article")).toBeInTheDocument();
  });
  it("does not render fictional articles when the locale has no content", () => {
    vi.mocked(useInfiniteBlogPosts).mockReturnValue({ posts: [], loading: false } as ReturnType<typeof useInfiniteBlogPosts>);
    const { container } = render(<HomepageBlogSection />);
    expect(container).toBeEmptyDOMElement();
    expect(useInfiniteBlogPosts).toHaveBeenCalledWith(expect.objectContaining({ language: "sk", scope: "public" }));
  });
  it("features the first real article and retains the remaining articles", () => {
    vi.mocked(useInfiniteBlogPosts).mockReturnValue({ posts: [{ id: "1", title: "First" }, { id: "2", title: "Second" }], loading: false } as ReturnType<typeof useInfiniteBlogPosts>);
    render(<HomepageBlogSection />);
    expect(screen.getByText("First")).toHaveAttribute("data-featured", "true");
    expect(screen.getByText("Second")).toHaveAttribute("data-featured", "false");
  });
});
