import { describe, it, expect, vi } from "vitest";
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

  it("preserves the same block formatting without DOMParser during SSR", () => {
    const html = '<p>First <a href="https://example.com">paragraph</a></p><p>Second</p>';
    const browserResult = stripExcerptLinks(html);
    vi.stubGlobal("DOMParser", undefined);
    try {
      expect(stripExcerptLinks(html)).toBe(browserResult);
      expect(browserResult).toBe("<p>First paragraph</p><p>Second</p>");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles quoted tag characters and preserves nested formatting", () => {
    expect(stripExcerptLinks('<p><A title="Read > more" href="https://example.com"><strong>Read</strong></A> <abbr>SB</abbr></p>')).toBe("<p><strong>Read</strong> <abbr>SB</abbr></p>");
  });
});
