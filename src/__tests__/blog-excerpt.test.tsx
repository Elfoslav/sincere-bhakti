import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogExcerpt from "@/components/BlogExcerpt";

const base = {
  excerpt: null,
  content: null,
  contentHtml: null,
};

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

  it("prefers a hand-written summary over the formatted body", () => {
    const { container } = render(
      <BlogExcerpt
        post={{ ...base, excerpt: "Summary", contentHtml: "<p>Hello <strong>world</strong></p>" }}
      />,
    );
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeNull();
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
