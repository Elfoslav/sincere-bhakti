import { describe, it, expect } from "vitest";
import {
  deriveBlogSlug,
  BLOG_SLUG_MAX_LENGTH,
  BLOG_TITLE_MAX_LENGTH,
  POST_SLUG_MAX_LENGTH,
} from "@/lib/validation";

describe("deriveBlogSlug", () => {
  it("shares the title's max length", () => {
    expect(BLOG_SLUG_MAX_LENGTH).toBe(BLOG_TITLE_MAX_LENGTH);
  });

  it("returns undefined for empty/nullish or punctuation-only titles", () => {
    expect(deriveBlogSlug(null)).toBeUndefined();
    expect(deriveBlogSlug(undefined)).toBeUndefined();
    expect(deriveBlogSlug("")).toBeUndefined();
    expect(deriveBlogSlug("!!!")).toBeUndefined();
  });

  it("slugifies short titles unchanged", () => {
    expect(deriveBlogSlug("Hare Krishna")).toBe("hare-krishna");
  });

  it("normalizes user-supplied slugs to URL-safe form", () => {
    expect(deriveBlogSlug("My Custom Slug!")).toBe("my-custom-slug");
    expect(deriveBlogSlug("  UPPER lower MiXeD  ")).toBe("upper-lower-mixed");
  });

  it("folds diacritics", () => {
    expect(deriveBlogSlug("Když přijdeš domů")).toBe("kdyz-prijdes-domu");
    expect(deriveBlogSlug("Śrī Kṛṣṇa")).toBe("sri-krsna");
  });

  it("caps long titles at BLOG_SLUG_MAX_LENGTH without ending mid-word", () => {
    const slug = deriveBlogSlug(
      "The glories of chanting the holy names of the Lord in this present age of Kali and beyond forever",
    )!;
    expect(slug.length).toBeLessThanOrEqual(BLOG_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("-")).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("allows slugs longer than POST_SLUG_MAX_LENGTH", () => {
    // A title whose slug lands between the timeline-post cap (60) and the
    // blog cap (100) must survive whole for blogs.
    const title =
      "Chanting the holy names together brings peace to every single heart";
    const slug = deriveBlogSlug(title)!;
    expect(slug.length).toBeGreaterThan(POST_SLUG_MAX_LENGTH);
    expect(slug.length).toBeLessThanOrEqual(BLOG_SLUG_MAX_LENGTH);
  });

  it("never exceeds BLOG_SLUG_MAX_LENGTH across varied inputs", () => {
    const inputs = [
      "Krátký text.",
      "word ".repeat(40),
      "Śrī Śrī Rādhā Kṛṣṇa! ".repeat(10),
      "a".repeat(150),
    ];
    for (const input of inputs) {
      const slug = deriveBlogSlug(input);
      if (slug === undefined) continue;
      expect(slug.length).toBeLessThanOrEqual(BLOG_SLUG_MAX_LENGTH);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
