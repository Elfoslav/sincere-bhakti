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

  it("marks the title as the current page and truncates it instead of repeating the H1", () => {
    render(
      <BlogLayout title="A very long article title that would wrap into a second headline">
        <p>body</p>
      </BlogLayout>,
    );

    const current = screen.getByText("A very long article title that would wrap into a second headline");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("title", "A very long article title that would wrap into a second headline");
    expect(current.className).toMatch(/truncate/);
    expect(current.className).not.toMatch(/text-lg/);
  });
});
