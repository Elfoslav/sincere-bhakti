import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@base-ui/react/tooltip", () => ({
  Tooltip: {
    Trigger: ({ closeOnClick, ...props }: React.ComponentProps<"button"> & { closeOnClick?: boolean }) => (
      <button data-close-on-click={String(closeOnClick)} {...props} />
    ),
  },
}));

import { TooltipTrigger } from "@/components/ui/tooltip";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TooltipTrigger", () => {
  it("keeps tooltips open on click by default for touch users", () => {
    render(<TooltipTrigger>Info</TooltipTrigger>);

    expect(screen.getByRole("button", { name: "Info" })).toHaveAttribute("data-close-on-click", "false");
  });

  it("allows callers to opt into close on click", () => {
    render(<TooltipTrigger closeOnClick>Info</TooltipTrigger>);

    expect(screen.getByRole("button", { name: "Info" })).toHaveAttribute("data-close-on-click", "true");
  });

  it("focuses itself before touch-style clicks so Base UI can open on tap", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {});
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<TooltipTrigger onClick={onClick} onPointerDown={onPointerDown}>Info</TooltipTrigger>);

    const trigger = screen.getByRole("button", { name: "Info" });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(onPointerDown).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });

  it("focuses itself on touchstart for mobile browsers without pointer events", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {});
    const onTouchStart = vi.fn();
    render(<TooltipTrigger onTouchStart={onTouchStart}>Info</TooltipTrigger>);

    fireEvent.touchStart(screen.getByRole("button", { name: "Info" }));

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(onTouchStart).toHaveBeenCalled();
  });
});
