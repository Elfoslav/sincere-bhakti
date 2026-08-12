import { describe, it, expect } from "vitest";
import {
  normalizeName,
} from "@/lib/validation";

describe("normalizeName", () => {
  it("strips diacritics from common Indic transliteration letters", () => {
    expect(normalizeName("Taruṇa Govinda Dāsa")).toBe("taruna govinda dasa");
  });

  it("handles Czech diacritics", () => {
    expect(normalizeName("Příliš žluťoučký kůň")).toBe("prilis zlutoucky kun");
  });

  it("handles French accents", () => {
    expect(normalizeName("Café à la crème naïve")).toBe("cafe a la creme naive");
  });

  it("handles German umlauts (ä/ö/ü decompose, ß is not a combining mark)", () => {
    expect(normalizeName("Müllerstraße")).toBe("mullerstraße");
  });

  it("handles Spanish accents and ñ", () => {
    expect(normalizeName("José María González")).toBe("jose maria gonzalez");
  });

  it("lowercases ASCII input", () => {
    expect(normalizeName("Hello World")).toBe("hello world");
  });

  it("collapses internal whitespace runs (spaces, tabs, newlines) to a single space", () => {
    expect(normalizeName("Krishna  Das")).toBe("krishna das");
    expect(normalizeName("Krishna\tDas")).toBe("krishna das");
    expect(normalizeName("Krishna \n Das")).toBe("krishna das");
    expect(normalizeName("  Krishna   Govinda   Das  ")).toBe("krishna govinda das");
  });

  // Guards the invariant the normalizedName backfill migration relies on:
  // re-normalizing an already-normalized value is a no-op, so re-collapsing the
  // STORED value equals re-normalizing from the original name.
  it("is idempotent", () => {
    for (const input of ["Krishna  Das", "Café  \t crème", "  Taruṇa   Govinda  ", "Müllerstraße"]) {
      expect(normalizeName(normalizeName(input))).toBe(normalizeName(input));
    }
  });

  it("returns empty string for empty input", () => {
    expect(normalizeName("")).toBe("");
  });

  it("preserves ASCII characters unchanged (apart from casing)", () => {
    expect(normalizeName("abc123")).toBe("abc123");
  });

  it("handles Devanagari characters (no change — no combining marks)", () => {
    expect(normalizeName("कृष्ण")).toBe("कृष्ण");
  });

  it("handles Tibetan characters (no change)", () => {
    expect(normalizeName("བོད་སྐད")).toBe("བོད་སྐད");
  });

  it("handles Czech name with parentheses for slug test", () => {
    expect(normalizeName("Tomáš Hromník (Taruna)")).toBe("tomas hromnik (taruna)");
  });

  it("strips polish L-stroke if it decomposes (single char, no combining)", () => {
    // ł in NFD stays as ł (single codepoint, not base+combining)
    expect(normalizeName("ł")).toBe("ł");
  });

  it("handles Danish ø (single char, no decomposition)", () => {
    expect(normalizeName("Rød")).toBe("rød");
  });

  it("does not crash on leading combining marks", () => {
    expect(normalizeName("\u0300abc")).toBe("abc");
  });

  it("handles purely non-diacritic Unicode (Cyrillic)", () => {
    expect(normalizeName("Привет")).toBe("привет");
  });

  it("preserves digits mixed with diacritics", () => {
    expect(normalizeName("Frédéric 2ème")).toBe("frederic 2eme");
  });

  it("handles underscores in name", () => {
    expect(normalizeName("Super_Devotee_123")).toBe("super_devotee_123");
  });
});
