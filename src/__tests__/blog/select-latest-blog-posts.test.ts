import { describe, it, expect } from "vitest";
import { selectLatestBlogPosts, LATEST_BLOG_POSTS_LIMIT } from "@/lib/blog";

function makePost(id: string) {
  return { id, title: id };
}

describe("selectLatestBlogPosts", () => {
  it("excludes the article being viewed", () => {
    const posts = [makePost("a"), makePost("b"), makePost("c")];
    expect(selectLatestBlogPosts(posts, "a")).toEqual([makePost("b"), makePost("c")]);
  });

  it(`caps the list at LATEST_BLOG_POSTS_LIMIT (${LATEST_BLOG_POSTS_LIMIT})`, () => {
    const posts = [makePost("current"), makePost("1"), makePost("2"), makePost("3"), makePost("4")];
    const selected = selectLatestBlogPosts(posts, "current");
    expect(selected).toHaveLength(LATEST_BLOG_POSTS_LIMIT);
    expect(selected.map((p) => p.id)).toEqual(["1", "2", "3"]);
  });

  it("keeps newest-first order", () => {
    const posts = [makePost("x"), makePost("y"), makePost("z")];
    expect(selectLatestBlogPosts(posts, "nope").map((p) => p.id)).toEqual(["x", "y", "z"]);
  });

  it("returns an empty list when only the current article exists", () => {
    expect(selectLatestBlogPosts([makePost("only")], "only")).toEqual([]);
  });

  it("respects a custom limit", () => {
    const posts = [makePost("a"), makePost("b"), makePost("c")];
    expect(selectLatestBlogPosts(posts, "a", 1)).toEqual([makePost("b")]);
  });
});
