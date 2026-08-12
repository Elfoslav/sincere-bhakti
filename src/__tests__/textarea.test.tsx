import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Textarea } from "@/components/ui/textarea";

function setScrollHeight(el: HTMLElement, value: number) {
  Object.defineProperty(el, "scrollHeight", { value, configurable: true });
}

describe("Textarea", () => {
  it("renders with the default size by default", () => {
    render(<Textarea aria-label="field" />);
    const el = screen.getByRole("textbox", { name: "field" });
    expect(el).toHaveAttribute("data-slot", "textarea");
    expect(el.className).toContain("min-h-20");
  });

  it("applies the compose size variant (desktop + mobile min-heights)", () => {
    render(<Textarea size="compose" aria-label="compose" />);
    const el = screen.getByRole("textbox", { name: "compose" });
    expect(el.className).toContain("min-h-28");
    expect(el.className).toContain("md:min-h-40");
    expect(el.className).toContain("resize-none");
  });

  it("auto-grows to fit content while typing", () => {
    render(<Textarea autoResize aria-label="grow" />);
    const el = screen.getByRole("textbox", { name: "grow" });
    setScrollHeight(el, 180);
    fireEvent.change(el, { target: { value: "line1\nline2\nline3" } });
    expect(el.style.height).toBe("180px");
  });

  it("caps auto-grow at maxHeight and scrolls beyond it", () => {
    render(<Textarea autoResize maxHeight={120} aria-label="capped" />);
    const el = screen.getByRole("textbox", { name: "capped" });
    setScrollHeight(el, 400);
    fireEvent.change(el, { target: { value: "very long content".repeat(50) } });
    expect(el.style.height).toBe("120px");
    expect(el.style.maxHeight).toBe("120px");
    expect(el.style.overflowY).toBe("auto");
  });

  it("recomputes height when the value changes programmatically", () => {
    const { rerender } = render(<Textarea autoResize value="some text" aria-label="reset" />);
    const el = screen.getByRole("textbox", { name: "reset" });
    setScrollHeight(el, 220);
    rerender(<Textarea autoResize value="" aria-label="reset" />);
    // The effect re-reads scrollHeight; with a shrunk measurement it snaps back.
    setScrollHeight(el, 40);
    rerender(<Textarea autoResize value="shorter" aria-label="reset" />);
    expect(el.style.height).toBe("40px");
  });

  it("forwards onChange to the caller", () => {
    const onChange = vi.fn();
    render(<Textarea autoResize onChange={onChange} aria-label="callback" />);
    const el = screen.getByRole("textbox", { name: "callback" });
    setScrollHeight(el, 60);
    fireEvent.change(el, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
