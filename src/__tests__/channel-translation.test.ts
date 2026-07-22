import { describe, it, expect } from "vitest";
import { resolveTranslation } from "@/lib/channel-translation";

const translations = [
  { language: "en", name: "English Name", slug: "english-slug" },
  { language: "cs", name: "České jméno", slug: "cesky-slug" },
  { language: "sk", name: "Slovenské meno", slug: "slovensky-slug" },
];

describe("resolveTranslation", () => {
  it("returns the matching translation for the requested language", () => {
    const result = resolveTranslation(translations, "cs");
    expect(result).toEqual({ language: "cs", name: "České jméno", slug: "cesky-slug" });
  });

  it("returns the first translation when no exact language match exists", () => {
    const result = resolveTranslation(translations, "de");
    expect(result).toEqual({ language: "en", name: "English Name", slug: "english-slug" });
  });

  it("returns null for an empty array", () => {
    const result = resolveTranslation([], "en");
    expect(result).toBeNull();
  });

  it("returns the only translation when array has one element", () => {
    const single = [{ language: "en", name: "Only", slug: "only" }];
    const result = resolveTranslation(single, "cs");
    expect(result).toEqual(single[0]);
  });

  it("matches exact language even when it is not first in the array", () => {
    const result = resolveTranslation(translations, "sk");
    expect(result).toEqual({ language: "sk", name: "Slovenské meno", slug: "slovensky-slug" });
  });
});
