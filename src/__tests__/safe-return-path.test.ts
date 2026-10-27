import { describe, expect, it } from "vitest";
import { getSafeReturnPath } from "@/lib/safe-return-path";

describe("getSafeReturnPath", () => {
  it("preserves app search, category and fragment destinations", () => {
    expect(getSafeReturnPath("/blog/category/practice?q=bhakti#latest")).toBe("/blog/category/practice?q=bhakti#latest");
  });
  it.each([null, "https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"])("rejects external and invalid destinations: %s", value => {
    expect(getSafeReturnPath(value)).toBe("/posts");
  });
});
