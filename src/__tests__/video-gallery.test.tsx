import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import VideoGallery from "@/components/VideoGallery";

describe("VideoGallery", () => {
  it("expands a video, pauses inline playback and allows closing the viewer", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    render(<VideoGallery videos={[{ url: "/a.mp4", type: "video" }, { url: "/b.mp4", type: "video" }]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "expandVideo" })[0]);
    const viewer = screen.getByRole("dialog");
    expect(viewer.querySelector("video")).toHaveAttribute("src", "/a.mp4");
    expect(viewer.querySelector("video")).toHaveAttribute("playsinline");
    expect(pause).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(viewer.querySelector("video")).toHaveAttribute("src", "/b.mp4");
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    pause.mockRestore();
  });
});
