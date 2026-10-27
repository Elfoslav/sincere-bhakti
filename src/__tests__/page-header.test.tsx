import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "@/components/PageHeader";

describe("PageHeader", () => {
  it("provides one page heading followed by its description", () => {
    render(<PageHeader title="Gallery" description="Albums from the community" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Gallery" }).closest("header")).toContainElement(screen.getByText("Albums from the community"));
  });

  it("supports the same editorial hierarchy and action for feed pages", () => {
    render(<PageHeader as="h2" variant="editorial" title="Articles" description="Community reflections" action={<button>Create</button>} />);
    const header = screen.getByRole("heading", { level: 2, name: "Articles" }).closest("header");
    expect(header).toHaveClass("page-header-editorial");
    expect(header).toContainElement(screen.getByText("Community reflections"));
    expect(header).toContainElement(screen.getByRole("button", { name: "Create" }));
  });

  it("does not create an empty description when only a title is supplied", () => {
    const { container } = render(<PageHeader title="Channels" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
