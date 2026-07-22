import { describe, it, expect } from "vitest";
import { resolveTranslation, resolveChannelTranslation } from "@/lib/channel-translation";

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

describe("resolveChannelTranslation", () => {
  it("preserves extra fields on the translation object", () => {
    const extended = translations.map((t) => ({ ...t, channelId: "ch-1" }));
    const result = resolveChannelTranslation(extended, "cs");
    expect(result).toEqual({ language: "cs", name: "České jméno", slug: "cesky-slug", channelId: "ch-1" });
  });

  it("falls back to first translation when no language match", () => {
    const extended = translations.map((t) => ({ ...t, channelId: "ch-1" }));
    const result = resolveChannelTranslation(extended, "de");
    expect(result?.channelId).toBe("ch-1");
    expect(result?.language).toBe("en");
  });

  it("returns null for empty array", () => {
    const result = resolveChannelTranslation([], "en");
    expect(result).toBeNull();
  });
});
