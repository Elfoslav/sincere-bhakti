import { describe, it, expect } from "vitest";
import { parseYouTubeUrl, getYouTubeEmbedUrl, extractYouTubeContent } from "@/lib/video";

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

  it("returns null for non-YouTube URL", () => {
    expect(getYouTubeEmbedUrl("https://example.com")).toBeNull();
  });
});

describe("extractYouTubeContent", () => {
  it("returns clean text when no YouTube URL", () => {
    const result = extractYouTubeContent("Hare Krishna!");
    expect(result.cleanContent).toBe("Hare Krishna!");
    expect(result.embedUrl).toBeNull();
  });

  it("extracts embed URL and cleans text", () => {
    const result = extractYouTubeContent(
      "Watch this: https://youtube.com/watch?v=dQw4w9WgXcQ Amazing!",
    );
    expect(result.cleanContent).toBe("Watch this:  Amazing!");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("removes trailing URL-only content", () => {
    const result = extractYouTubeContent("https://youtu.be/dQw4w9WgXcQ");
    expect(result.cleanContent).toBeNull();
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("returns null for null input", () => {
    const result = extractYouTubeContent(null);
    expect(result.cleanContent).toBeNull();
    expect(result.embedUrl).toBeNull();
  });
});
