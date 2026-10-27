import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import ImageGallery from "@/components/ImageGallery";

const t = (key: string) => key;
const images = [{ url: "/images/article-tulsi.jpg", width: 1200, height: 800 }];

describe("ImageGallery", () => {
  it("preserves intrinsic dimensions in the default gallery", () => {
    const { container } = render(<ImageGallery images={images} t={t} />);
    expect(container.querySelector("img")).toHaveAttribute("width", "1200");
    expect(container.querySelector("img")).toHaveStyle({ height: "auto", maxHeight: "440px" });
  });

  it.each([{ photos: images }, { photos: [{ url: "/images/article-tulsi.jpg" }] }])("crops compact known and legacy images while retaining the full lightbox", ({ photos }) => {
    const { container } = render(<ImageGallery images={photos} t={t} variant="compact" />);
    expect(container.querySelector('[data-status]')).toHaveStyle({ aspectRatio: "1.12" });
    fireEvent.click(screen.getByRole("button", { name: "openImage" }));
    expect(screen.getByRole("dialog").querySelector("img")).toHaveAttribute("src", photos[0].url);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps multiple-photo overflow and navigation in compact mode", () => {
    render(<ImageGallery images={Array.from({ length: 5 }, (_, index) => ({ url: `/image-${index}.jpg` }))} t={t} variant="compact" />);
    expect(screen.getAllByRole("button", { name: "openImage" })).toHaveLength(4);
    expect(screen.getByText("+1")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "openImage" })[3]);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").querySelector("img")).toHaveAttribute("src", "/image-4.jpg");
  });
});
