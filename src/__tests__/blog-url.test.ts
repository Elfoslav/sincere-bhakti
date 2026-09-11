import { describe, it, expect } from "vitest";
import { getBlogUrl, getStaleBlogSlugRedirect } from "@/lib/blog-url";

describe("getBlogUrl", () => {
  it("returns bare shortId URL when no slug", () => {
    expect(getBlogUrl("abc123")).toBe("/blog/abc123");
  });

  it("appends slug when present", () => {
    expect(getBlogUrl("abc123", "my-title")).toBe("/blog/abc123/my-title");
  });

  it("ignores null slug", () => {
    expect(getBlogUrl("abc123", null)).toBe("/blog/abc123");
  });
});

describe("getStaleBlogSlugRedirect", () => {
  it("returns null when no slug segment in URL", () => {
    expect(getStaleBlogSlugRedirect(undefined, "abc123", "my-title")).toBeNull();
  });

  it("returns null when slug matches", () => {
    expect(getStaleBlogSlugRedirect("my-title", "abc123", "my-title")).toBeNull();
  });

  it("returns canonical URL when slug is stale", () => {
    expect(getStaleBlogSlugRedirect("old-title", "abc123", "new-title")).toBe("/blog/abc123/new-title");
  });

  it("returns bare URL when current slug is null", () => {
    expect(getStaleBlogSlugRedirect("old-title", "abc123", null)).toBe("/blog/abc123");
  });
});
