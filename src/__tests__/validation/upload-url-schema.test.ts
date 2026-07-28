import { describe, it, expect } from "vitest";
import {
  uploadUrlSchema,
} from "@/lib/validation";

describe("uploadUrlSchema", () => {
  it("accepts valid input", () => {
    const result = uploadUrlSchema.safeParse({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      postId: "post-123",
      channelId: "channel-1",
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
