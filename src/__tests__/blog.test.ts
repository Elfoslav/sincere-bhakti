import { describe, it, expect } from "vitest";
import { toDateTimeLocalValue, parseDateTimeLocalValue, isBlogPubliclyVisible } from "@/lib/blog";

describe("toDateTimeLocalValue", () => {
  it("formats a Date to datetime-local shape", () => {
    const value = toDateTimeLocalValue(new Date(2026, 8, 11, 10, 5));
    expect(value).toBe("2026-09-11T10:05");
  });

  it("accepts ISO strings", () => {
    const value = toDateTimeLocalValue("2026-09-11T10:05:00.000Z");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns empty string for nullish or invalid input", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(undefined)).toBe("");
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });
});

describe("parseDateTimeLocalValue", () => {
  it("parses datetime-local input to Date", () => {
    const parsed = parseDateTimeLocalValue("2026-09-11T10:05");
    expect(parsed).toBeInstanceOf(Date);
  });

  it("returns undefined for blank or invalid input", () => {
    expect(parseDateTimeLocalValue("")).toBeUndefined();
    expect(parseDateTimeLocalValue("   ")).toBeUndefined();
    expect(parseDateTimeLocalValue("nope")).toBeUndefined();
  });
});

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
