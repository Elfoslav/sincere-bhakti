import { describe, it, expect } from "vitest";
import { derivePostSlugFromContent, POST_SLUG_MAX_LENGTH } from "@/lib/validation";

describe("derivePostSlugFromContent", () => {
  it("derives slug from linkTitle for URL-only content", () => {
    const slug = derivePostSlugFromContent(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "Bhagavad Gita Chapter One",
    );
    expect(slug).toBe("bhagavad-gita-chapter-one");
  });

  it("strips URLs for mixed content and ignores linkTitle", () => {
    const slug = derivePostSlugFromContent(
      "Check this out https://example.com amazing teaching",
      "Example Title",
    );
    // Should derive from stripped text, not title
    expect(slug).toBe("check-this-out-amazing-teaching");
    expect(slug).not.toContain("example-title");
    expect(slug).not.toContain("https");
  });

  it("falls back to linkTitle when stripped text is empty", () => {
    const slug = derivePostSlugFromContent("https://example.com", "Some Page Title");
    expect(slug).toBe("some-page-title");
  });

  it("returns undefined (null in DB) for URL-only without title", () => {
    expect(derivePostSlugFromContent("https://example.com")).toBeUndefined();
    expect(derivePostSlugFromContent("https://www.youtube.com/watch?v=abc")).toBeUndefined();
  });

  it("never returns https slug", () => {
    const cases: Array<[string, string | undefined]> = [
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", undefined],
      ["https://example.com/path?query=1", "My Title"],
      ["Check https://example.com", undefined],
      ["https://example.com", "Title With Diacritics když"],
    ];
    for (const [content, title] of cases) {
      const slug = derivePostSlugFromContent(content, title);
      if (slug) {
        expect(slug.startsWith("https")).toBe(false);
        expect(slug.startsWith("http")).toBe(false);
      }
    }
  });

  it("handles diacritics in title", () => {
    const slug = derivePostSlugFromContent("https://example.com", "Když přijdeš domů");
    expect(slug).toBe("kdyz-prijdes-domu");
  });

  it("derives slug from stripped text when text exists even without title", () => {
    const slug = derivePostSlugFromContent("Hare Krishna! https://example.com");
    expect(slug).toBe("hare-krishna");
  });

  it("respects maxLength for title-derived slugs", () => {
    const longTitle = "This is a very long title that definitely exceeds the sixty character limit for post slugs";
    const slug = derivePostSlugFromContent("https://example.com", longTitle)!;
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("matches previous behaviour for non-URL content", () => {
    expect(derivePostSlugFromContent("Hello World")).toBe("hello-world");
    expect(derivePostSlugFromContent("  Hello, World!  ")).toBe("hello-world");
  });
});
