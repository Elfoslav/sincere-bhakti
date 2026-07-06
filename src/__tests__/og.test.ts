import { describe, it, expect } from "vitest";
import { selectOgImageUrl } from "@/lib/og";

const landscape = { url: "https://r2.dev/l.jpg", type: "image", width: 1600, height: 900 };
const portrait = { url: "https://r2.dev/p.jpg", type: "image", width: 900, height: 1600 };
const square = { url: "https://r2.dev/s.jpg", type: "image", width: 1000, height: 1000 };
const noDims = { url: "https://r2.dev/u.jpg", type: "image", width: null, height: null };

describe("selectOgImageUrl", () => {
  it("returns null when there are no images", () => {
    expect(selectOgImageUrl([{ url: "https://youtube.com/embed/x", type: "youtube" }])).toBeNull();
    expect(selectOgImageUrl([])).toBeNull();
  });

  it("prefers a landscape image over an earlier portrait one", () => {
    expect(selectOgImageUrl([portrait, landscape])).toBe(landscape.url);
  });

  it("treats a square image as landscape", () => {
    expect(selectOgImageUrl([portrait, square])).toBe(square.url);
  });

  it("falls back to the first image when none are landscape", () => {
    expect(selectOgImageUrl([portrait, noDims])).toBe(portrait.url);
  });

  it("falls back to the first image when dimensions are unknown", () => {
    expect(selectOgImageUrl([noDims])).toBe(noDims.url);
  });

  it("does not change the display order — selection is independent", () => {
    // portrait is first for display; OG still picks the landscape image.
    const media = [portrait, landscape, square];
    expect(selectOgImageUrl(media)).toBe(landscape.url);
    expect(media[0]).toBe(portrait);
  });

  it("ignores non-image media", () => {
    const media = [
      { url: "https://youtube.com/embed/x", type: "youtube" },
      { url: "https://r2.dev/v.mp4", type: "video" },
      landscape,
    ];
    expect(selectOgImageUrl(media)).toBe(landscape.url);
  });
});
