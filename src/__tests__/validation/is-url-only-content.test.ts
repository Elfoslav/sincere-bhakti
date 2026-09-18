import { describe, it, expect } from "vitest";
import { isUrlOnlyContent } from "@/lib/validation";

describe("isUrlOnlyContent", () => {
  it("returns true for bare URLs", () => {
    expect(isUrlOnlyContent("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isUrlOnlyContent("https://example.com")).toBe(true);
    expect(isUrlOnlyContent("  https://example.com  ")).toBe(true);
  });

  it("returns true for multiple URLs with only whitespace", () => {
    expect(isUrlOnlyContent("https://a.com https://b.com")).toBe(true);
    expect(isUrlOnlyContent("https://a.com\nhttps://b.com")).toBe(true);
  });

  it("returns false for mixed text and URL", () => {
    expect(isUrlOnlyContent("Check https://example.com out")).toBe(false);
    expect(isUrlOnlyContent("Hello https://example.com")).toBe(false);
    expect(isUrlOnlyContent("https://example.com is great")).toBe(false);
  });

  it("returns false for text without URLs", () => {
    expect(isUrlOnlyContent("Hare Krishna")).toBe(false);
    expect(isUrlOnlyContent("")).toBe(false);
    expect(isUrlOnlyContent(null)).toBe(false);
    expect(isUrlOnlyContent(undefined)).toBe(false);
  });

  it("handles URL with surrounding punctuation from autolink cleaning", () => {
    expect(isUrlOnlyContent("https://example.com.")).toBe(false); // trailing "." is kept as text
  });
});
