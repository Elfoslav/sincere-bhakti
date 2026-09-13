import { describe, it, expect } from "vitest";
import { stripExcerptLinks } from "@/lib/excerpt";

describe("stripExcerptLinks", () => {
  it("unwraps links but keeps their text", () => {
    expect(stripExcerptLinks('<p>Read <a href="https://example.com">more</a> here</p>')).toBe(
      "<p>Read more here</p>",
    );
  });

  it("leaves link-free markup untouched", () => {
    expect(stripExcerptLinks("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });
});
