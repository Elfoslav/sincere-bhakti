import { describe, it, expect } from "vitest";
import { updateBlogPostSchema } from "@/lib/validation";

describe("updateBlogPostSchema", () => {
  it("accepts an empty patch (no-op)", () => {
    expect(updateBlogPostSchema.safeParse({}).success).toBe(true);
  });

  it("accepts title and visibility changes", () => {
    const parsed = updateBlogPostSchema.safeParse({ title: "New title", isPublic: false });
    expect(parsed.success).toBe(true);
  });

  it("rejects blank titles", () => {
    expect(updateBlogPostSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("rejects clearing both text fields at once", () => {
    expect(updateBlogPostSchema.safeParse({ content: "", excerpt: "" }).success).toBe(false);
  });

  it("accepts clearing one field while setting the other", () => {
    expect(updateBlogPostSchema.safeParse({ content: null, excerpt: "still here" }).success).toBe(true);
  });

  it("accepts null publishedAt (clear schedule)", () => {
    const parsed = updateBlogPostSchema.safeParse({ publishedAt: null });
    expect(parsed.success).toBe(true);
  });

  it("accepts a custom slug", () => {
    const parsed = updateBlogPostSchema.safeParse({ slug: "my-custom-slug" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("my-custom-slug");
    }
  });

  it("accepts null slug (clear back to derived)", () => {
    const parsed = updateBlogPostSchema.safeParse({ slug: null });
    expect(parsed.success).toBe(true);
  });

  it("rejects over-long slugs", () => {
    expect(updateBlogPostSchema.safeParse({ slug: "x".repeat(101) }).success).toBe(false);
  });
});
