import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb } from "@/lib/color-contrast";
import { LOGO_CONTRAST_FILTER } from "@/components/BrandLogo";

// The light palette in globals.css is the only supported theme (see
// docs/design-system.md), so these floors guard it against regressions.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const rootBlock = css.match(/:root \{([\s\S]*?)\n\}/)![1];
const tokens = new Map(Array.from(rootBlock.matchAll(/--([\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing token --${name}`);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return alias ? token(alias[1]) : value;
}

const AA_TEXT = 4.5;
const ratio = (fg: string, bg: string) => contrastRatio(token(fg), token(bg));

describe("light palette text contrast (WCAG AA 4.5:1)", () => {
  const surfaces = ["background", "card", "popover", "muted", "secondary"] as const;

  it.each(surfaces)("foreground text reads on %s", (surface) => {
    expect(ratio("foreground", surface)).toBeGreaterThanOrEqual(7);
  });

  it.each(surfaces)("muted-foreground reads on %s", (surface) => {
    expect(ratio("muted-foreground", surface)).toBeGreaterThanOrEqual(AA_TEXT + 0.5);
  });

  it.each(surfaces)("primary (links, brass text) reads on %s", (surface) => {
    expect(ratio("primary", surface)).toBeGreaterThanOrEqual(AA_TEXT + 0.5);
  });

  it.each(surfaces)("destructive and success text read on %s", (surface) => {
    expect(ratio("destructive", surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio("success", surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("button label colors read on their fills", () => {
    expect(ratio("primary-foreground", "primary")).toBeGreaterThanOrEqual(AA_TEXT + 0.5);
    expect(ratio("primary-foreground", "primary-hover")).toBeGreaterThanOrEqual(AA_TEXT + 0.5);
    expect(ratio("destructive-foreground", "destructive")).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("hover brass is darker than the resting brass", () => {
    expect(ratio("primary-hover", "background")).toBeGreaterThan(ratio("primary", "background"));
  });
});

describe("light palette non-text contrast (WCAG 1.4.11)", () => {
  it("field borders reach 3:1 on both field surfaces", () => {
    expect(ratio("input", "background")).toBeGreaterThanOrEqual(3);
    expect(ratio("input", "card")).toBeGreaterThanOrEqual(3);
  });

  it("card and divider borders are visible, not near-invisible", () => {
    expect(ratio("border", "background")).toBeGreaterThanOrEqual(1.6);
    expect(ratio("border", "card")).toBeGreaterThanOrEqual(1.7);
  });

  it("the focus ring reaches 3:1", () => {
    expect(ratio("ring", "background")).toBeGreaterThanOrEqual(3);
    expect(ratio("ring", "card")).toBeGreaterThanOrEqual(3);
  });
});

describe("logo contrast", () => {
  // Dominant gold of public/images/sincere-bhakti-logo.png (median opaque pixel).
  const LOGO_GOLD: [number, number, number] = [210, 149, 24];

  it("the contrast filter lifts the logo's gold above 4.5:1 on the background", () => {
    const brightness = Number(LOGO_CONTRAST_FILTER.match(/brightness\(([\d.]+)\)/)![1]);
    const deepened = LOGO_GOLD.map((c) => Math.round(c * brightness));
    const hex = "#" + deepened.map((c) => c.toString(16).padStart(2, "0")).join("");
    expect(hexToRgb(hex)).toEqual(deepened);
    expect(contrastRatio(hex, token("background"))).toBeGreaterThanOrEqual(4.5);
    // ...where the unfiltered artwork does not.
    expect(contrastRatio("#d29518", token("background"))).toBeLessThan(3);
  });
});
