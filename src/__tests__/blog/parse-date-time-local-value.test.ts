import { describe, it, expect } from "vitest";
import { parseDateTimeLocalValue } from "@/lib/blog";

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
