import { describe, expect, it } from "vitest";
import { matchesSearch, splitSearchTerms } from "@/lib/feed-search";
import { FEED_SEARCH_MAX_TERMS } from "@/lib/validation";

describe("splitSearchTerms", () => {
  it("splits on any whitespace and drops blanks", () => {
    expect(splitSearchTerms("  holy \t name\n")).toEqual(["holy", "name"]);
    expect(splitSearchTerms(undefined)).toEqual([]);
  });

  it("caps the number of terms", () => {
    const query = Array.from({ length: FEED_SEARCH_MAX_TERMS + 2 }, (_, i) => `t${i}`).join(" ");
    expect(splitSearchTerms(query)).toHaveLength(FEED_SEARCH_MAX_TERMS);
  });
});

describe("matchesSearch", () => {
  it("matches everything for a blank query", () => {
    expect(matchesSearch("", "anything")).toBe(true);
    expect(matchesSearch(undefined)).toBe(true);
  });

  it("is case-insensitive and requires every term", () => {
    expect(matchesSearch("HOLY name", "The holy Name today")).toBe(true);
    expect(matchesSearch("holy kirtan", "The holy name today")).toBe(false);
  });

  it("lets terms match different fields and ignores empty ones", () => {
    expect(matchesSearch("bhakti yoga", "Bhakti", null, "a path of Yoga")).toBe(true);
    expect(matchesSearch("bhakti", null, undefined)).toBe(false);
  });
});
