import { describe, it, expect } from "vitest";
import {
  registerSchema,
  createPostSchema,
  updatePostSchema,
  updateNameSchema,
  paginationSchema,
  uploadUrlSchema,
  maxUploadSizeForContentType,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  getAcceptString,
  ALLOWED_UPLOAD_CONTENT_TYPES,
  isTrustedMediaUrl,
  normalizeName,
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

  it("accepts private scope", () => {
    const result = paginationSchema.safeParse({ scope: "private" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid scope", () => {
    const result = paginationSchema.safeParse({ scope: "invalid" });
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
      postId: "post-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fileName", () => {
    const result = uploadUrlSchema.safeParse({ contentType: "image/jpeg", postId: "post-123" });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentType", () => {
    const result = uploadUrlSchema.safeParse({ fileName: "photo.jpg", postId: "post-123" });
    expect(result.success).toBe(false);
  });

  it("rejects missing postId", () => {
    const result = uploadUrlSchema.safeParse({ fileName: "photo.jpg", contentType: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fileName", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "",
      contentType: "image/jpeg",
      postId: "post-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fileName over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "a".repeat(256),
      contentType: "image/jpeg",
      postId: "post-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contentType over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "a".repeat(256),
      postId: "post-123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts video content types", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "clip.mp4",
      contentType: "video/mp4",
      postId: "post-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects disallowed content types", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "page.html",
      contentType: "text/html",
      postId: "post-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects SVG uploads (stored XSS risk)", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "image.svg",
      contentType: "image/svg+xml",
      postId: "post-123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts video/ogg", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "clip.ogv",
      contentType: "video/ogg",
      postId: "post-123",
    });
    expect(result.success).toBe(true);
  });
});

describe("getAcceptString", () => {
  it("includes every allowed content type", () => {
    const accept = getAcceptString();
    for (const ct of ALLOWED_UPLOAD_CONTENT_TYPES) {
      expect(accept).toContain(ct);
    }
    expect(accept.split(",")).toHaveLength(ALLOWED_UPLOAD_CONTENT_TYPES.length);
  });
});

describe("maxUploadSizeForContentType", () => {
  it("returns the video limit for video/* types", () => {
    expect(maxUploadSizeForContentType("video/mp4")).toBe(MAX_VIDEO_SIZE_BYTES);
  });

  it("returns the image limit for image/* types", () => {
    expect(maxUploadSizeForContentType("image/png")).toBe(MAX_IMAGE_SIZE_BYTES);
  });

  it("falls back to the stricter image limit for other types", () => {
    expect(maxUploadSizeForContentType("application/octet-stream")).toBe(
      MAX_IMAGE_SIZE_BYTES,
    );
  });

  it("caps videos at 200 MB and images at 10 MB", () => {
    expect(MAX_VIDEO_SIZE_BYTES).toBe(200 * 1024 * 1024);
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("isTrustedMediaUrl", () => {
  const storageDomain = "https://cdn.example.com";

  it("accepts storage domain URLs for images", () => {
    expect(isTrustedMediaUrl("https://cdn.example.com/posts/abc.jpg", "image", storageDomain)).toBe(true);
  });

  it("accepts storage domain URLs for videos", () => {
    expect(isTrustedMediaUrl("https://cdn.example.com/posts/vid.mp4", "video", storageDomain)).toBe(true);
  });

  it("accepts YouTube embed URLs", () => {
    expect(isTrustedMediaUrl("https://www.youtube.com/embed/abc123defgh", "youtube", storageDomain)).toBe(true);
  });

  it("rejects external URLs for images", () => {
    expect(isTrustedMediaUrl("https://evil.com/track.png", "image", storageDomain)).toBe(false);
  });

  it("rejects non-embed YouTube URLs", () => {
    expect(isTrustedMediaUrl("https://www.youtube.com/watch?v=abc123", "youtube", storageDomain)).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isTrustedMediaUrl("javascript:alert(1)", "image", storageDomain)).toBe(false);
  });
});

describe("normalizeName", () => {
  it("strips diacritics from common Indic transliteration letters", () => {
    expect(normalizeName("Taruṇa Govinda Dāsa")).toBe("taruna govinda dasa");
  });

  it("handles Czech diacritics", () => {
    expect(normalizeName("Příliš žluťoučký kůň")).toBe("prilis zlutoucky kun");
  });

  it("handles French accents", () => {
    expect(normalizeName("Café à la crème naïve")).toBe("cafe a la creme naive");
  });

  it("handles German umlauts (ä/ö/ü decompose, ß is not a combining mark)", () => {
    expect(normalizeName("Müllerstraße")).toBe("mullerstraße");
  });

  it("handles Spanish accents and ñ", () => {
    expect(normalizeName("José María González")).toBe("jose maria gonzalez");
  });

  it("lowercases ASCII input", () => {
    expect(normalizeName("Hello World")).toBe("hello world");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeName("")).toBe("");
  });

  it("preserves ASCII characters unchanged (apart from casing)", () => {
    expect(normalizeName("abc123")).toBe("abc123");
  });

  it("handles Devanagari characters (no change — no combining marks)", () => {
    expect(normalizeName("कृष्ण")).toBe("कृष्ण");
  });

  it("handles Tibetan characters (no change)", () => {
    expect(normalizeName("བོད་སྐད")).toBe("བོད་སྐད");
  });
});
