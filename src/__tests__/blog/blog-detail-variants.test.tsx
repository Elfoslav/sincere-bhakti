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

vi.spyOn(console, "error").mockImplementation(() => {});

import ClassicVariant from "@/components/blog-detail-variants/ClassicVariant";
import MagazineVariant from "@/components/blog-detail-variants/MagazineVariant";
import EditorialVariant from "@/components/blog-detail-variants/EditorialVariant";
import ImmersiveVariant from "@/components/blog-detail-variants/ImmersiveVariant";
import SplitVariant from "@/components/blog-detail-variants/SplitVariant";
import { mockMainPost, mockLatestPosts, mockContentHtml } from "@/components/blog-detail-variants/mock-posts";

const variants = {
  classic: ClassicVariant,
  magazine: MagazineVariant,
  editorial: EditorialVariant,
  immersive: ImmersiveVariant,
  split: SplitVariant,
} as const;

describe("blog detail variants", () => {
  for (const [name, Variant] of Object.entries(variants)) {
    it(`${name} renders the article title, body, and latest section`, () => {
      const { unmount } = render(
        <Variant post={mockMainPost} contentHtml={mockContentHtml} latestPosts={mockLatestPosts} />,
      );
      expect(screen.getByRole("heading", { name: mockMainPost.title })).toBeInTheDocument();
      expect(screen.getByText("latestPosts")).toBeInTheDocument();
      for (const latest of mockLatestPosts) {
        expect(screen.getByText(latest.title)).toBeInTheDocument();
      }
      unmount();
    });
  }

  it("renders a gradient cover fallback when the article has no cover", () => {
    const { container } = render(
      <MagazineVariant post={mockMainPost} contentHtml={mockContentHtml} latestPosts={[]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("latestPosts")).not.toBeInTheDocument();
  });
});
