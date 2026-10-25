import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UploadSizeMeter from "@/components/UploadSizeMeter";

const MB = 1024 * 1024;

describe("UploadSizeMeter", () => {
  it("renders nothing when no upload is selected", () => {
    const { container } = render(<UploadSizeMeter used={0} max={10 * MB} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the used size against the limit as an accessible meter", () => {
    render(<UploadSizeMeter used={2 * MB} max={10 * MB} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", String(2 * MB));
    expect(meter).toHaveAttribute("aria-valuemax", String(10 * MB));
    expect(meter.firstElementChild).toHaveStyle({ width: "20%" });
  });

  it("uses the brand role until near the limit, then the destructive role", () => {
    const { rerender } = render(<UploadSizeMeter used={5 * MB} max={10 * MB} />);
    expect(screen.getByRole("meter").firstElementChild).toHaveClass("bg-primary");
    rerender(<UploadSizeMeter used={9.5 * MB} max={10 * MB} />);
    expect(screen.getByRole("meter").firstElementChild).toHaveClass("bg-destructive");
  });

  it("caps the bar at the limit", () => {
    render(<UploadSizeMeter used={20 * MB} max={10 * MB} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", String(10 * MB));
    expect(meter.firstElementChild).toHaveStyle({ width: "100%" });
  });
});
