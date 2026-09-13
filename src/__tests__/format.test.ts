import { describe, it, expect } from "vitest";
import { BYTES_PER_MB, formatBytes, formatDisplayDate } from "@/lib/format";

describe("formatBytes", () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1_024)).toBe("1 KB");
    expect(formatBytes(1_536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1_048_576)).toBe("1 MB");
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1_073_741_824)).toBe("1 GB");
  });

  it("rounds to one decimal place", () => {
    expect(formatBytes(3_145_728)).toBe("3 MB");
    expect(formatBytes(3_408_435)).toBe("3.3 MB");
  });

  it("handles unexpected negative input gracefully", () => {
    expect(formatBytes(-100)).toBe("NaN undefined");
  });
});

describe("BYTES_PER_MB", () => {
  it("equals one mebibyte", () => {
    expect(BYTES_PER_MB).toBe(1024 * 1024);
  });
});

describe("formatDisplayDate", () => {
  it("formats a Date with the locale month name", () => {
    expect(formatDisplayDate(new Date(2026, 8, 11), "en")).toBe("September 11, 2026");
  });

  it("accepts ISO strings from API payloads", () => {
    expect(formatDisplayDate("2026-09-01T00:00:00.000Z", "en")).toMatch(/September \d, 2026/);
  });

  it("uses the given locale for non-English month names", () => {
    expect(formatDisplayDate(new Date(2026, 8, 11), "cs")).toBe("11. září 2026");
  });

  it("includes the time when requested", () => {
    expect(formatDisplayDate(new Date(2026, 8, 11, 10, 5), "en", { withTime: true })).toContain("2026");
  });

  it("returns an empty string for nullish or invalid input", () => {
    expect(formatDisplayDate(null, "en")).toBe("");
    expect(formatDisplayDate(undefined, "en")).toBe("");
    expect(formatDisplayDate("not-a-date", "en")).toBe("");
  });
});
