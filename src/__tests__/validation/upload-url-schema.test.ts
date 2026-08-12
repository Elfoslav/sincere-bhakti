import { describe, it, expect } from "vitest";
import {
  uploadUrlSchema,
} from "@/lib/validation";

describe("uploadUrlSchema", () => {
  it("accepts valid input", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      postId: "11111111-1111-4111-8111-111111111111",
      channelId: "channel-1",
      contentLength: 12345,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID postId (blocks R2 key injection)", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      postId: "../../evil",
      contentLength: 12345,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentLength (unbounded upload guard)", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fileName", () => {
    const result = uploadUrlSchema.safeParse({ contentType: "image/jpeg", postId: "11111111-1111-4111-8111-111111111111" });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentType", () => {
    const result = uploadUrlSchema.safeParse({ fileName: "photo.jpg", postId: "11111111-1111-4111-8111-111111111111" });
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
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fileName over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "a".repeat(256),
      contentType: "image/jpeg",
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contentType over 255 chars", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "a".repeat(256),
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("accepts video content types", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "clip.mp4",
      contentType: "video/mp4",
      postId: "11111111-1111-4111-8111-111111111111",
      contentLength: 12345,
    });
    expect(result.success).toBe(true);
  });

  it("rejects disallowed content types", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "page.html",
      contentType: "text/html",
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("rejects SVG uploads (stored XSS risk)", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "image.svg",
      contentType: "image/svg+xml",
      postId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("accepts video/ogg", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "clip.ogv",
      contentType: "video/ogg",
      postId: "11111111-1111-4111-8111-111111111111",
      contentLength: 12345,
    });
    expect(result.success).toBe(true);
  });
});
