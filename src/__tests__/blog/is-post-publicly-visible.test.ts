import { describe, it, expect } from "vitest";
import { isPostPubliclyVisible } from "@/lib/blog";

describe("isPostPubliclyVisible", () => {
  it("hides private posts", () => {
    expect(isPostPubliclyVisible({ isPublic: false, publishedAt: null })).toBe(false);
  });

  it("shows public posts without a publish date", () => {
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: null })).toBe(true);
  });

  it("hides scheduled promos with future publish dates", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: future })).toBe(false);
  });

  it("shows promos whose publish date has passed", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: past })).toBe(true);
  });

  it("accepts ISO-string publish dates (API payloads)", () => {
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: "2026-09-01T00:00:00.000Z" })).toBe(true);
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: new Date(Date.now() + 86_400_000).toISOString() })).toBe(false);
  });

  it("fails closed on undecodable publish dates", () => {
    expect(isPostPubliclyVisible({ isPublic: true, publishedAt: "not-a-date" })).toBe(false);
  });
});
