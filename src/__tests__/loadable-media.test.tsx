import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import { LoadableMedia } from "@/components/ui/loadable-media";

function renderImage(props: { showLoading?: boolean } = {}) {
  return render(
    <LoadableMedia {...props}>
      {({ ref, onLoad, onError }) => <img ref={ref} src="/x.jpg" alt="pic" onLoad={onLoad} onError={onError} />}
    </LoadableMedia>,
  );
}

describe("LoadableMedia", () => {
  it("shows a loading placeholder until the media loads", () => {
    const { container } = renderImage();
    expect(container.firstElementChild).toHaveAttribute("data-status", "loading");
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    fireEvent.load(screen.getByAltText("pic"));
    expect(container.firstElementChild).toHaveAttribute("data-status", "loaded");
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("shows an unavailable message with a retry button on error", () => {
    renderImage();
    fireEvent.error(screen.getByAltText("pic"));
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });

  it("remounts the media and returns to loading on retry", () => {
    const { container } = renderImage();
    const first = screen.getByAltText("pic");
    fireEvent.error(first);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-status", "loading");
    const second = screen.getByAltText("pic");
    expect(second).not.toBe(first);
    fireEvent.load(second);
    expect(container.firstElementChild).toHaveAttribute("data-status", "loaded");
  });

  it("omits the loading placeholder when showLoading is false but still reports errors", () => {
    const { container } = renderImage({ showLoading: false });
    expect(container.querySelector(".animate-pulse")).toBeNull();
    fireEvent.error(screen.getByAltText("pic"));
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });

  it("settles an image that already failed before hydration", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    renderImage();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
    complete.mockRestore();
    width.mockRestore();
  });

  it("settles an image that already loaded before hydration", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(640);
    const { container } = renderImage();
    expect(container.firstElementChild).toHaveAttribute("data-status", "loaded");
    complete.mockRestore();
    width.mockRestore();
  });

  it("does not flag an already-rendered SVG with zero natural width as failed", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const { container } = render(
      <LoadableMedia>
        {({ ref, onLoad, onError }) => <img ref={ref} src="/logo.svg" alt="logo" onLoad={onLoad} onError={onError} />}
      </LoadableMedia>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-status", "loaded");
    complete.mockRestore();
    width.mockRestore();
  });

  it("settles a video whose metadata loaded before hydration", () => {
    const ready = vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(1);
    const { container } = render(
      <LoadableMedia>
        {({ ref, onLoad, onError }) => <video ref={ref} src="/v.mp4" onLoadedMetadata={onLoad} onError={onError} />}
      </LoadableMedia>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-status", "loaded");
    expect(container.querySelector(".animate-pulse")).toBeNull();
    ready.mockRestore();
  });
});
