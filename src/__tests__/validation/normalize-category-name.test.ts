import { describe, it, expect } from "vitest";
import { normalizeCategoryName } from "@/lib/validation";

describe("normalizeCategoryName", () => {
  it("forces title case", () => {
    expect(normalizeCategoryName("bhakti")).toBe("Bhakti");
    expect(normalizeCategoryName("HOLY NAME")).toBe("Holy Name");
    expect(normalizeCategoryName("sIX gOSWAMIS")).toBe("Six Goswamis");
  });

  it("trims and collapses whitespace runs to a single space", () => {
    expect(normalizeCategoryName("  holy   name  ")).toBe("Holy Name");
    expect(normalizeCategoryName("eka\tdasi\nmahatmya")).toBe("Eka Dasi Mahatmya");
  });

  it("allows multiple words in one category", () => {
    expect(normalizeCategoryName("Six Goswamis of Vrindavan")).toBe("Six Goswamis Of Vrindavan");
  });

  it("capitalizes hyphenated compounds too", () => {
    expect(normalizeCategoryName("well-known")).toBe("Well-Known");
  });

  it("preserves diacritics as typed", () => {
    expect(normalizeCategoryName("kršna")).toBe("Kršna");
  });

  it("unifies case and spacing variants to one key", () => {
    const variants = ["holy  name", "Holy Name", "HOLY NAME", "  holy name "];
    const normalized = new Set(variants.map(normalizeCategoryName));
    expect(normalized.size).toBe(1);
  });
});
