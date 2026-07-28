import { describe, it, expect } from "vitest";
import {
  derivePostSlug,
  POST_SLUG_MAX_LENGTH,
} from "@/lib/validation";

describe("derivePostSlug", () => {
  it("returns undefined for empty/nullish or punctuation-only content", () => {
    expect(derivePostSlug(null)).toBeUndefined();
    expect(derivePostSlug(undefined)).toBeUndefined();
    expect(derivePostSlug("")).toBeUndefined();
    expect(derivePostSlug("!!!")).toBeUndefined();
  });

  it("lowercases, collapses non-alphanumerics to dashes, and trims", () => {
    expect(derivePostSlug("  Hello, World!  ")).toBe("hello-world");
    expect(derivePostSlug("UPPER lower MiXeD")).toBe("upper-lower-mixed");
  });

  it("keeps short slugs unchanged", () => {
    const slug = derivePostSlug("Hare Krishna");
    expect(slug).toBe("hare-krishna");
    expect(slug!.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
  });

  it("caps long content at POST_SLUG_MAX_LENGTH and never ends mid-word", () => {
    const slug = derivePostSlug(
      "The glories of chanting the holy names of the Lord in this age of Kali",
    )!;
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    // cut at a word boundary — the last word must be whole ("in", not "i")
    expect(slug).toBe("the-glories-of-chanting-the-holy-names-of-the-lord-in-this");
  });

  it("hard-cuts a single word longer than the limit", () => {
    const slug = derivePostSlug("a".repeat(70))!;
    expect(slug).toBe("a".repeat(POST_SLUG_MAX_LENGTH));
  });
});

describe("derivePostSlug — diacritics & sentence boundaries", () => {
  const userExample =
    "Testujeme jak to jen jde.\n\noukey.\n\neh. A co když bude text delší? Co se stane pak? Nechceme moc dlouhý SLUG.";

  it("folds Czech diacritics instead of dropping the letters", () => {
    expect(derivePostSlug("Když přijdeš domů")).toBe("kdyz-prijdes-domu");
    expect(derivePostSlug("Dlouhý čas")).toBe("dlouhy-cas");
  });

  it("folds Slovak diacritics", () => {
    expect(derivePostSlug("Ďakujem veľmi pekne")).toBe("dakujem-velmi-pekne");
  });

  it("folds IAST / Sanskrit diacritics", () => {
    expect(derivePostSlug("Śrī Kṛṣṇa Caitanya Mahāprabhu")).toBe(
      "sri-krsna-caitanya-mahaprabhu",
    );
    expect(derivePostSlug("Bhagavad-gītā")).toBe("bhagavad-gita");
  });

  it("matches the reported example: folds diacritics AND ends on a sentence boundary", () => {
    const slug = derivePostSlug(userExample)!;
    // whole words (kdyz/delsi), not the old mangled kdy/del
    expect(slug).toBe("testujeme-jak-to-jen-jde-oukey-eh-a-co-kdyz-bude-text-delsi");
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
    // ends at the end of a sentence ("...delší?"), NOT the start of the next one ("Co se stane…")
    expect(slug.endsWith("delsi")).toBe(true);
    expect(slug.endsWith("-co")).toBe(false);
    expect(slug).not.toContain("kdy-"); // "když" was not truncated to "kdy"
    expect(slug).not.toContain("del-"); // "delší" was not truncated to "del"
  });

  it("stops at the last whole sentence that fits, dropping the overflowing one", () => {
    const slug = derivePostSlug(
      "First short one. Second sentence here. This third sentence is long enough to push us over the limit for sure.",
    )!;
    expect(slug).toBe("first-short-one-second-sentence-here");
    expect(slug).not.toContain("third");
  });

  it("falls back to a word boundary when the first sentence alone exceeds the limit", () => {
    const slug = derivePostSlug(
      "The glories of chanting the holy names of the Lord in this present age of Kali",
    )!;
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    // word-boundary cut: the last token must be a whole word from the text
    expect(slug.split("-").every((w) => w.length > 0)).toBe(true);
  });

  it("does not collapse to a tiny slug when a short first sentence precedes a long one", () => {
    const slug = derivePostSlug(
      "Hi. The eternal glories of devotional service to the supreme lord unfold here",
    )!;
    // Must NOT be just the 2-char first sentence; falls back to a word-boundary
    // cut of the full text so the slug stays useful.
    expect(slug).not.toBe("hi");
    expect(slug.length).toBeGreaterThan(POST_SLUG_MAX_LENGTH / 2);
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("hi-the-eternal")).toBe(true);
  });

  it("never exceeds POST_SLUG_MAX_LENGTH and never ends with a dash across varied inputs", () => {
    const inputs = [
      "Krátký text.",
      userExample,
      "Jedna. Dvě. Tři. Čtyři. Pět. Šest. Sedm. Osm. Devět. Deset. Jedenáct. Dvanáct.",
      "a".repeat(80),
      "Śrī Śrī Rādhā Kṛṣṇa! ".repeat(10),
      "Multiple!!! Punctuation??? Marks... here.",
      "word ".repeat(40),
    ];
    for (const input of inputs) {
      const slug = derivePostSlug(input);
      if (slug === undefined) continue;
      expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX_LENGTH);
      expect(slug.startsWith("-")).toBe(false);
      expect(slug.endsWith("-")).toBe(false);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("returns undefined for diacritic-only or punctuation-only content", () => {
    expect(derivePostSlug("!!! ??? ...")).toBeUndefined();
    expect(derivePostSlug("。。。")).toBeUndefined();
  });
});
