import { describe, it, expect } from "vitest";
import { createBlogPostSchema } from "@/lib/validation";

describe("createBlogPostSchema", () => {
  it("accepts a minimal title + content post", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "  My Title  ", content: "Hello" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("My Title");
      expect(parsed.data.isPublic).toBe(true);
      expect(parsed.data.language).toBe("en");
    }
  });

  it("accepts excerpt-only posts (content optional)", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "T", excerpt: "Summary" });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "   ", content: "x" });
    expect(parsed.success).toBe(false);
  });

  it("rejects posts with neither content nor excerpt", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "T" });
    expect(parsed.success).toBe(false);
  });

  it("rejects over-long titles", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "x".repeat(151), content: "y" });
    expect(parsed.success).toBe(false);
  });

  it("rejects dangerous cover URLs", () => {
    const parsed = createBlogPostSchema.safeParse({
      title: "T",
      content: "y",
      coverUrl: "javascript:alert(1)",
    });
    expect(parsed.success).toBe(false);
  });

  it("treats explicit null publishedAt as omitted (no epoch coercion)", () => {
    const parsed = createBlogPostSchema.safeParse({ title: "T", content: "y", publishedAt: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.publishedAt).toBeUndefined();
    }
  });

  it("accepts https cover URLs and coerces publishedAt", () => {
    const parsed = createBlogPostSchema.safeParse({
      title: "T",
      content: "y",
      coverUrl: "https://example.com/cover.jpg",
      publishedAt: "2026-09-11T10:05",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.publishedAt).toBeInstanceOf(Date);
    }
  });
});
