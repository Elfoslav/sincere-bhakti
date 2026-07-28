import { describe, it, expect } from "vitest";
import {
  isTrustedMediaUrl,
} from "@/lib/validation";

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
