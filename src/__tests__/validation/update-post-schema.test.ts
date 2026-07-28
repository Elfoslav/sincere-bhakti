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
});
