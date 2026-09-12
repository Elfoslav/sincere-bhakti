import { describe, it, expect } from "vitest";
import {
  updatePostSchema,
} from "@/lib/validation";

describe("updatePostSchema", () => {
  it("accepts content-only update", () => {
    const result = updatePostSchema.safeParse({ content: "Updated!" });
    expect(result.success).toBe(true);
  });

  it("accepts media-only update", () => {
    const result = updatePostSchema.safeParse({
      media: [{ url: "https://example.com/img.jpg", type: "image" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts clearing content while keeping media", () => {
    const result = updatePostSchema.safeParse({ content: null });
    expect(result.success).toBe(true);
  });

  it("accepts clearing media while keeping content", () => {
    const result = updatePostSchema.safeParse({ media: [] });
    expect(result.success).toBe(true);
  });

  it("rejects clearing both content and media simultaneously", () => {
    const result = updatePostSchema.safeParse({ content: null, media: [] });
    expect(result.success).toBe(false);
  });

  it("rejects clearing both with empty content string and empty media", () => {
    const result = updatePostSchema.safeParse({ content: "", media: [] });
    expect(result.success).toBe(false);
  });

  it("accepts changing visibility only", () => {
    const result = updatePostSchema.safeParse({ isPublic: false });
    expect(result.success).toBe(true);
  });

  it("accepts linking a blog article", () => {
    const result = updatePostSchema.safeParse({ blogPostId: "blog-1" });
    expect(result.success).toBe(true);
  });

  it("accepts clearing the blog link", () => {
    const result = updatePostSchema.safeParse({ blogPostId: null });
    expect(result.success).toBe(true);
  });

  it("accepts clearing text when linking an article", () => {
    const result = updatePostSchema.safeParse({ content: null, media: [], blogPostId: "blog-1" });
    expect(result.success).toBe(true);
  });

  it("accepts rescheduling the publish date", () => {
    const result = updatePostSchema.safeParse({
      publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publishedAt).toBeInstanceOf(Date);
    }
  });

  it("accepts clearing the publish date with null", () => {
    const result = updatePostSchema.safeParse({ publishedAt: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publishedAt).toBeNull();
    }
  });
});
