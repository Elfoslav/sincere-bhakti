import { describe, it, expect } from "vitest";
import { getPostUrl, getStalePostSlugRedirect } from "@/lib/post-url";

describe("getPostUrl", () => {
  it("includes the slug when present", () => {
    expect(getPostUrl("abc12345", "hello-world")).toBe("/posts/abc12345/hello-world");
  });

  it("omits the slug segment when null or undefined", () => {
    expect(getPostUrl("abc12345", null)).toBe("/posts/abc12345");
    expect(getPostUrl("abc12345")).toBe("/posts/abc12345");
  });

  it("omits the slug segment when empty string", () => {
    expect(getPostUrl("abc12345", "")).toBe("/posts/abc12345");
  });
});

describe("getStalePostSlugRedirect", () => {
  it("returns null when no slug segment was provided (bare /posts/{shortId} is allowed)", () => {
    expect(getStalePostSlugRedirect(undefined, "abc12345", "current-slug")).toBeNull();
    expect(getStalePostSlugRedirect(undefined, "abc12345", null)).toBeNull();
  });

  it("returns null when the provided slug already matches the current slug", () => {
    expect(getStalePostSlugRedirect("current-slug", "abc12345", "current-slug")).toBeNull();
  });

  it("redirects an old slug to the current canonical slug (the edited-post case)", () => {
    expect(getStalePostSlugRedirect("old-title", "abc12345", "new-title")).toBe(
      "/posts/abc12345/new-title",
    );
  });

  it("redirects to the bare shortId when the post no longer has a slug", () => {
    expect(getStalePostSlugRedirect("old-title", "abc12345", null)).toBe("/posts/abc12345");
  });

  it("redirects a stale empty slug segment to the canonical slug", () => {
    expect(getStalePostSlugRedirect("", "abc12345", "current-slug")).toBe(
      "/posts/abc12345/current-slug",
    );
  });
});
