import { describe, it, expect } from "vitest";
import { toDateTimeLocalValue } from "@/lib/blog";

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
