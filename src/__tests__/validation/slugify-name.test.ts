import { describe, it, expect } from "vitest";
import {
  slugifyName,
} from "@/lib/validation";

describe("slugifyName", () => {
  it("converts Czech name with diacritics and parentheses", () => {
    expect(slugifyName("Tomáš Hromník (Taruna)")).toBe("tomas-hromnik-taruna");
  });

  it("handles Indic transliteration", () => {
    expect(slugifyName("Taruṇa Govinda Dāsa")).toBe("taruna-govinda-dasa");
  });

  it("converts simple ASCII name", () => {
    expect(slugifyName("Krishna Das")).toBe("krishna-das");
  });

  it("collapses multiple special chars into single dash", () => {
    expect(slugifyName("Hello...World!!")).toBe("hello-world");
  });

  it("trims leading and trailing non-alphanumeric chars", () => {
    expect(slugifyName("  --hello!!  ")).toBe("hello");
  });

  it("handles French accents", () => {
    expect(slugifyName("Café à la crème")).toBe("cafe-a-la-creme");
  });

  it("returns 'channel' for string with no valid slug chars", () => {
    expect(slugifyName("!!! +++")).toBe("channel");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    expect(slugifyName(long).length).toBeLessThanOrEqual(80);
  });

  it("treats dots and parentheses as separators", () => {
    expect(slugifyName("Dr. Livingstone (I presume)")).toBe("dr-livingstone-i-presume");
  });

  it("handles empty string", () => {
    expect(slugifyName("")).toBe("channel");
  });
});
