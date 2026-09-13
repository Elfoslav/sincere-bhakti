import { describe, it, expect } from "vitest";
import { formatBlogDate } from "@/lib/blog";

describe("formatBlogDate", () => {
  it("formats a Date with the locale month name", () => {
    expect(formatBlogDate(new Date(2026, 8, 11), "en")).toBe("September 11, 2026");
  });

  it("accepts ISO strings from API payloads", () => {
    expect(formatBlogDate("2026-09-01T00:00:00.000Z", "en")).toMatch(/September \d, 2026/);
  });

  it("uses the given locale for non-English month names", () => {
    expect(formatBlogDate(new Date(2026, 8, 11), "cs")).toBe("11. září 2026");
  });

  it("returns an empty string for nullish or invalid input", () => {
    expect(formatBlogDate(null, "en")).toBe("");
    expect(formatBlogDate(undefined, "en")).toBe("");
    expect(formatBlogDate("not-a-date", "en")).toBe("");
  });
});
