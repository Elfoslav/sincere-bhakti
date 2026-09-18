import { describe, it, expect } from "vitest";
import { stripUrlsFromContent } from "@/lib/validation";

describe("stripUrlsFromContent", () => {
  it("returns text without URLs", () => {
    expect(stripUrlsFromContent("Hello https://example.com world")).toBe("Hello  world");
  });

  it("returns empty string for URL-only content", () => {
    expect(stripUrlsFromContent("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("");
    expect(stripUrlsFromContent("https://example.com")).toBe("");
  });

  it("handles multiple URLs", () => {
    expect(stripUrlsFromContent("https://a.com https://b.com")).toBe(" ");
  });

  it("preserves text with no URLs", () => {
    expect(stripUrlsFromContent("Hare Krishna, hello!")).toBe("Hare Krishna, hello!");
  });

  it("strips URLs with trailing punctuation handling via autolink", () => {
    // autolink cleans trailing punctuation, so "Check https://example.com." -> text includes "."
    expect(stripUrlsFromContent("Check https://example.com.")).toBe("Check .");
  });
});
