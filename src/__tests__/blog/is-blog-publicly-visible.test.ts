import { describe, it, expect } from "vitest";
import { isBlogPubliclyVisible } from "@/lib/blog";

describe("isBlogPubliclyVisible", () => {
  it("hides private posts", () => {
    expect(isBlogPubliclyVisible({ isPublic: false, publishedAt: null })).toBe(false);
  });

  it("shows public posts without a publish date", () => {
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: null })).toBe(true);
  });

  it("hides scheduled posts with future publish dates", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: future })).toBe(false);
  });

  it("accepts ISO-string publish dates (API payloads)", () => {
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: "2026-09-01T00:00:00.000Z" })).toBe(true);
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: new Date(Date.now() + 86_400_000).toISOString() })).toBe(false);
  });

  it("fails closed on undecodable publish dates", () => {
    expect(isBlogPubliclyVisible({ isPublic: true, publishedAt: "not-a-date" })).toBe(false);
  });
});
