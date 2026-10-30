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
    expect(screen.getByRole("button", { name: "close" })).toHaveTextContent("close");
    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
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
  it("swipes left and right, stops at either end, and ignores a post-swipe click", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    fireEvent.touchStart(dialog, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchEnd(dialog, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 210 }] });
    expect(screen.getByAltText("imageAlt 3/3")).toBeInTheDocument();
    fireEvent.click(dialog);
    expect(dialog).toBeInTheDocument();
    fireEvent.touchStart(dialog, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchEnd(dialog, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    expect(screen.getByAltText("imageAlt 3/3")).toBeInTheDocument();
    for (let i = 0; i < 3; i++) {
      fireEvent.touchStart(dialog, { touches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
      fireEvent.touchEnd(dialog, { touches: [], changedTouches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    }
    expect(screen.getByAltText("imageAlt 1/3")).toBeInTheDocument();
  });

  it("ignores taps, short movements and vertical gestures", () => {
    render(<Harness />);
    const image = screen.getByAltText("imageAlt 2/3");
    for (const end of [{ x: 100, y: 200 }, { x: 80, y: 200 }, { x: 180, y: 400 }]) {
      fireEvent.touchStart(image, { touches: [{ identifier: 0, clientX: 100, clientY: 200 }] });
      fireEvent.touchEnd(image, { touches: [], changedTouches: [{ identifier: 0, clientX: end.x, clientY: end.y }] });
      expect(image).toBeInTheDocument();
    }
  });

  it("cancels multi-touch and interrupted gestures", () => {
    render(<Harness />);
    const image = screen.getByAltText("imageAlt 2/3");
    fireEvent.touchStart(image, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchMove(image, { touches: [{ identifier: 0 }, { identifier: 1 }] });
    fireEvent.touchEnd(image, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    expect(image).toBeInTheDocument();
    fireEvent.touchStart(image, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchCancel(image);
    fireEvent.touchEnd(image, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    expect(image).toBeInTheDocument();
  });

  it("leaves native video controls and zoomed-image panning alone", () => {
    const onNavigate = vi.fn();
    const { unmount } = render(<MediaLightbox images={[{ url: "/video.mp4", type: "video" }, ...images]} currentIndex={0} onClose={vi.fn()} onNavigate={onNavigate} />);
    const video = screen.getByLabelText("video");
    fireEvent.touchStart(video, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchEnd(video, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    expect(onNavigate).not.toHaveBeenCalled();
    unmount();
    const original = window.visualViewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { scale: 2 } });
    render(<Harness />);
    const image = screen.getByAltText("imageAlt 2/3");
    fireEvent.touchStart(image, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchEnd(image, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    expect(image).toBeInTheDocument();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: original });
  });

  it("allows the next deliberate touch to close after swiping", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    fireEvent.touchStart(dialog, { touches: [{ identifier: 0, clientX: 240, clientY: 200 }] });
    fireEvent.touchEnd(dialog, { touches: [], changedTouches: [{ identifier: 0, clientX: 80, clientY: 200 }] });
    const close = screen.getByRole("button", { name: "close" });
    fireEvent.touchStart(close, { touches: [{ identifier: 0, clientX: 280, clientY: 30 }] });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

});
