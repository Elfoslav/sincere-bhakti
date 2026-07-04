import { describe, it, expect } from "vitest";
import {
  registerSchema,
  createPostSchema,
  updateNameSchema,
  paginationSchema,
  uploadUrlSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      name: "Krishna Das",
      email: "kdas@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = registerSchema.safeParse({
      email: "kdas@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "k@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("lowercases email", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "KriShna@ExamplE.Com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("krishna@example.com");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 50 chars", () => {
    const result = registerSchema.safeParse({
      name: "A".repeat(51),
      email: "k@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });
});

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

describe("updateNameSchema", () => {
  it("accepts valid name", () => {
    const result = updateNameSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = updateNameSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = updateNameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.scope).toBeUndefined();
    }
  });

  it("parses limit from string", () => {
    const result = paginationSchema.safeParse({ limit: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });

  it("rejects limit over 50", () => {
    const result = paginationSchema.safeParse({ limit: "100" });
    expect(result.success).toBe(false);
  });

  it("accepts public scope", () => {
    const result = paginationSchema.safeParse({ scope: "public" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid scope", () => {
    const result = paginationSchema.safeParse({ scope: "private" });
    expect(result.success).toBe(false);
  });

  it("accepts language filter", () => {
    const result = paginationSchema.safeParse({ language: "cs" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("cs");
    }
  });

  it("rejects invalid language filter", () => {
    const result = paginationSchema.safeParse({ language: "fr" });
    expect(result.success).toBe(false);
  });
});

describe("uploadUrlSchema", () => {
  it("accepts valid input", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fileName", () => {
    const result = uploadUrlSchema.safeParse({ contentType: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentType", () => {
    const result = uploadUrlSchema.safeParse({ fileName: "photo.jpg" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fileName", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "",
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fileName over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "a".repeat(256),
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contentType over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});
