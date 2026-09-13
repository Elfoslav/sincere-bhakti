import { describe, it, expect } from "vitest";
import { makeContentUrl, makeStaleSlugRedirect } from "@/lib/content-url";

describe("makeContentUrl", () => {
  it("returns the bare shortId URL when no slug", () => {
    expect(makeContentUrl("posts", "abc123")).toBe("/posts/abc123");
    expect(makeContentUrl("blog", "abc123")).toBe("/blog/abc123");
  });

  it("appends the slug when present", () => {
    expect(makeContentUrl("posts", "abc123", "my-title")).toBe("/posts/abc123/my-title");
  });

  it("ignores a null slug", () => {
    expect(makeContentUrl("blog", "abc123", null)).toBe("/blog/abc123");
  });
});

describe("makeStaleSlugRedirect", () => {
  it("returns null without a slug segment or on a fresh slug", () => {
    expect(makeStaleSlugRedirect("posts", undefined, "abc123", "my-title")).toBeNull();
    expect(makeStaleSlugRedirect("posts", "my-title", "abc123", "my-title")).toBeNull();
  });

  it("returns the canonical URL for a stale slug", () => {
    expect(makeStaleSlugRedirect("blog", "old-title", "abc123", "new-title")).toBe("/blog/abc123/new-title");
  });
});
