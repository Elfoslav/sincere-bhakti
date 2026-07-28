import { describe, it, expect } from "vitest";
import {
  createPostSchema,
} from "@/lib/validation";

describe("createPostSchema", () => {
  it("accepts content only", () => {
    const result = createPostSchema.safeParse({
      content: "Hare Krishna!",
      isPublic: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts media only", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "https://example.com/image.jpg", type: "image" }],
      isPublic: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts content + multiple media", () => {
    const result = createPostSchema.safeParse({
      content: "Check this out!",
      media: [
        { url: "https://example.com/img1.jpg", type: "image" },
        { url: "https://example.com/vid.mp4", type: "video" },
        { url: "https://www.youtube.com/embed/abc123defgh", type: "youtube" },
      ],
      isPublic: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.media).toHaveLength(3);
    }
  });

  it("rejects empty content and media", () => {
    const result = createPostSchema.safeParse({ isPublic: true });
    expect(result.success).toBe(false);
  });

  it("rejects invalid media URL", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "not-a-url", type: "image" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional media dimensions", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "https://example.com/i.jpg", type: "image", width: 1600, height: 900 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.media[0].width).toBe(1600);
      expect(result.data.media[0].height).toBe(900);
    }
  });

  it("rejects non-positive or non-integer dimensions", () => {
    expect(
      createPostSchema.safeParse({
        media: [{ url: "https://example.com/i.jpg", type: "image", width: 0, height: 900 }],
      }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({
        media: [{ url: "https://example.com/i.jpg", type: "image", width: 12.5, height: 900 }],
      }).success,
    ).toBe(false);
  });

  it("rejects javascript: media URL", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "javascript:alert(1)", type: "file" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects data: media URL", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "data:text/html,<script>alert(1)</script>", type: "file" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid media type", () => {
    const result = createPostSchema.safeParse({
      media: [{ url: "https://example.com/file", type: "audio" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 media items", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      url: `https://example.com/${i}.jpg`,
      type: "image" as const,
    }));
    const result = createPostSchema.safeParse({ media: items });
    expect(result.success).toBe(false);
  });

  it("defaults isPublic to true", () => {
    const result = createPostSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPublic).toBe(true);
    }
  });

  it("defaults language to en", () => {
    const result = createPostSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("en");
    }
  });

  it("accepts valid languages", () => {
    const result = createPostSchema.safeParse({ content: "Hello", language: "cs" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("cs");
    }
  });

  it("rejects invalid language", () => {
    const result = createPostSchema.safeParse({ content: "Hello", language: "fr" });
    expect(result.success).toBe(false);
  });
});
