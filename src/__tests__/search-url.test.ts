import { describe, expect, it } from "vitest";
import { withSearchQuery } from "@/lib/search-url";
describe("withSearchQuery", () => {
  it("preserves filters and safely encodes user text", () => {
    expect(withSearchQuery("/blog?channelId=one#results", " holy & name ")).toBe("/blog?channelId=one&q=holy+%26+name#results");
  });
  it("removes an empty query without discarding the category", () => {
    expect(withSearchQuery("/posts/category/bhakti?q=old", " ")).toBe("/posts/category/bhakti");
  });
});
