import { describe, it, expect } from "vitest";
import { getLatestBlogPostsGridClass } from "@/lib/blog";

describe("getLatestBlogPostsGridClass", () => {
  it("spans a single article full width", () => {
    expect(getLatestBlogPostsGridClass(1)).toBe("grid grid-cols-1 gap-4");
  });

  it("renders two articles in two columns on wider screens", () => {
    expect(getLatestBlogPostsGridClass(2)).toBe("grid grid-cols-1 gap-4 sm:grid-cols-2");
  });

  it("renders three articles in three columns on wide screens", () => {
    expect(getLatestBlogPostsGridClass(3)).toBe("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3");
  });

  it("falls back to a single column for empty counts", () => {
    expect(getLatestBlogPostsGridClass(0)).toBe("grid grid-cols-1 gap-4");
  });
});
