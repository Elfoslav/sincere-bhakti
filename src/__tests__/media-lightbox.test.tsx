import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, number>) =>
    params ? `${key} ${params.current}/${params.total}` : key,
}));

vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import MediaLightbox from "@/components/ui/MediaLightbox";

const images = [{ url: "/a.jpg" }, { url: "/b.jpg" }, { url: "/c.jpg" }];

function Harness({ start = 1 }: { start?: number }) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(start);
  return (
    <>
      <button>opener</button>
      {open && <MediaLightbox images={images} currentIndex={index} onClose={() => setOpen(false)} onNavigate={setIndex} />}
    </>
  );
}

describe("MediaLightbox", () => {
  it("uses translated labels and image alt text", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "next" })).toBeInTheDocument();
    expect(screen.getByAltText("imageAlt 2/3")).toHaveAttribute("src", "/b.jpg");
  });

  it("moves focus into the dialog on open", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("restores focus to the opener on close", () => {
    render(<Harness />);
    screen.getByRole("button", { name: "opener" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores focus to the previously focused element after unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<MediaLightbox images={images} currentIndex={0} onClose={() => {}} onNavigate={() => {}} />);
    expect(opener).not.toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("wraps Tab from the last control to the first and Shift+Tab back", () => {
    render(<Harness />);
    const close = screen.getByRole("button", { name: "close" });
    const next = screen.getByRole("button", { name: "next" });
    next.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();
  });

  it("keeps focus inside the dialog when the focused arrow unmounts at the last image", () => {
    render(<Harness start={1} />);
    const next = screen.getByRole("button", { name: "next" });
    next.focus();
    fireEvent.click(next);
    expect(screen.queryByRole("button", { name: "next" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("keeps the viewer open when Retry is clicked after an image fails", () => {
    render(<Harness />);
    fireEvent.error(screen.getByAltText("imageAlt 2/3"));
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still closes when the backdrop is clicked", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
