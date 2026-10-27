vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "@/components/ui/input";

describe("Input error association", () => {
  it("reveals a password without changing its value or submitting", () => {
    const submit = vi.fn();
    render(<form onSubmit={submit}><Input aria-label="Password" type="password" defaultValue="secret value" revealPassword /></form>);
    fireEvent.click(screen.getByRole("button", { name: "showPassword" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue("secret value");
    fireEvent.click(screen.getByRole("button", { name: "hidePassword" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(submit).not.toHaveBeenCalled();
  });
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
