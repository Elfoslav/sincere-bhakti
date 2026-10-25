import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb } from "@/lib/color-contrast";

describe("hexToRgb", () => {
  it("parses long and short hex colors", () => {
    expect(hexToRgb("#886326")).toEqual([136, 99, 38]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("rejects non-hex input", () => {
    expect(() => hexToRgb("rgb(1,2,3)")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#886326", "#f7f4ec")).toBeCloseTo(contrastRatio("#f7f4ec", "#886326"), 10);
  });

  it("matches a known WCAG reference value", () => {
    // #767676 on white is the classic 4.54:1 AA boundary.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});
