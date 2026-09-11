import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const messages: Record<string, string> = {
      title: "Blog",
    };
    return messages[key] ?? key;
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import BlogLayout from "@/components/BlogLayout";

describe("BlogLayout", () => {
  it("renders a Blog > title breadcrumb with a link to the index", () => {
    render(
      <BlogLayout title="My Article">
        <p>body</p>
      </BlogLayout>,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("Blog");
    expect(nav).toHaveTextContent("My Article");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
