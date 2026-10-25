import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";

describe("Input error association", () => {
  it("links the error message to the field and marks it invalid", () => {
    render(<Input aria-label="Name" errorMessage="Required" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    const error = screen.getByText("Required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(error.id).not.toBe("");
  });

  it("preserves a caller-supplied aria-describedby", () => {
    render(<Input aria-label="Name" aria-describedby="hint" errorMessage="Required" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("aria-describedby")).toBe(`hint ${screen.getByText("Required").id}`);
  });

  it("adds no aria-describedby or aria-invalid without an error", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});
