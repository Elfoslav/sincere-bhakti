import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogExcerpt, { stripExcerptLinks } from "@/components/BlogExcerpt";

const base = {
  excerpt: null,
  content: null,
  contentHtml: null,
};

describe("stripExcerptLinks", () => {
  it("unwraps links but keeps their text", () => {
    expect(stripExcerptLinks('<p>Read <a href="https://example.com">more</a> here</p>')).toBe(
      "<p>Read more here</p>",
    );
  });

  it("leaves link-free markup untouched", () => {
    expect(stripExcerptLinks("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });
});

describe("BlogExcerpt", () => {
  it("prefers the plain excerpt", () => {
    render(<BlogExcerpt post={{ ...base, excerpt: "Summary" }} />);
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });

  it("renders formatted article HTML when no excerpt is set", () => {
    const { container } = render(
      <BlogExcerpt post={{ ...base, contentHtml: "<p>Hello <strong>world</strong></p>" }} />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("world");
  });

  it("strips links from the formatted excerpt", () => {
    const { container } = render(
      <BlogExcerpt
        post={{ ...base, contentHtml: '<p>Read <a href="https://example.com">more</a></p>' }}
      />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("Read more");
  });

  it("falls back to plain preview for bodies without rendered HTML", () => {
    render(<BlogExcerpt post={{ ...base, content: "Just text" }} />);
    expect(screen.getByText("Just text")).toBeInTheDocument();
  });

  it("renders nothing when there is no text at all", () => {
    const { container } = render(<BlogExcerpt post={base} />);
    expect(container.innerHTML).toBe("");
  });
});
