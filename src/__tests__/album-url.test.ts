import { describe, it, expect } from "vitest";
import { getAlbumUrl, getStaleAlbumSlugRedirect } from "@/lib/album-url";

describe("getAlbumUrl", () => {
  it("builds a slugged album URL", () => {
    expect(getAlbumUrl("abc12345", "festival-2026")).toBe("/gallery/abc12345/festival-2026");
  });

  it("omits the slug segment when there is none", () => {
    expect(getAlbumUrl("abc12345", null)).toBe("/gallery/abc12345");
  });
});

describe("getStaleAlbumSlugRedirect", () => {
  it("returns null when no slug was provided", () => {
    expect(getStaleAlbumSlugRedirect(undefined, "abc12345", "festival")).toBeNull();
  });

  it("returns null when the slug is current", () => {
    expect(getStaleAlbumSlugRedirect("festival", "abc12345", "festival")).toBeNull();
  });

  it("returns the canonical path for a stale slug", () => {
    expect(getStaleAlbumSlugRedirect("old-name", "abc12345", "new-name")).toBe(
      "/gallery/abc12345/new-name",
    );
  });
});
