import { describe, it, expect } from "vitest";
import { parseYouTubeUrl, getYouTubeEmbedUrl, isStandaloneYouTubeUrl } from "@/lib/video";

describe("parseYouTubeUrl", () => {
  it("extracts ID from watch URL", () => {
    expect(parseYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be URL", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from embed URL", () => {
    expect(parseYouTubeUrl("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a shorts URL", () => {
    expect(parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a shorts URL with params", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID with extra params", () => {
    expect(parseYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ&t=120s")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(parseYouTubeUrl("https://vimeo.com/123")).toBeNull();
  });

  it("returns null for invalid video ID", () => {
    expect(parseYouTubeUrl("https://youtube.com/watch?v=short")).toBeNull();
  });
});

describe("getYouTubeEmbedUrl", () => {
  it("converts watch URL to embed URL", () => {
    expect(getYouTubeEmbedUrl("https://youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts shorts URL to embed URL", () => {
    expect(getYouTubeEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ"))
      .toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(getYouTubeEmbedUrl("https://example.com")).toBeNull();
  });
});

describe("isStandaloneYouTubeUrl", () => {
  it("is true for a lone watch URL", () => {
    expect(isStandaloneYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("is true for a lone youtu.be URL with surrounding whitespace", () => {
    expect(isStandaloneYouTubeUrl("  https://youtu.be/dQw4w9WgXcQ\n")).toBe(true);
  });

  it("is true for a lone shorts URL", () => {
    expect(isStandaloneYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
  });

  it("is false when the link has surrounding prose", () => {
    expect(isStandaloneYouTubeUrl("Watch this https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });

  it("is false for a non-YouTube URL", () => {
    expect(isStandaloneYouTubeUrl("https://example.com")).toBe(false);
  });

  it("is false for null or empty input", () => {
    expect(isStandaloneYouTubeUrl(null)).toBe(false);
    expect(isStandaloneYouTubeUrl("")).toBe(false);
  });
});
