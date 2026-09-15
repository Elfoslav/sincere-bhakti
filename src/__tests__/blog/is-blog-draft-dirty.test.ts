import { describe, it, expect } from "vitest";
import { isBlogDraftDirty, type BlogDraftSnapshot } from "@/lib/blog";

function snapshot(overrides: Partial<BlogDraftSnapshot> = {}): BlogDraftSnapshot {
  return {
    title: "My Article",
    slug: "my-article",
    excerpt: "Summary",
    content: "Hello world",
    coverUrl: "",
    hasCoverFile: false,
    categories: ["Bhakti"],
    isPublic: true,
    publishedAt: "2026-09-01T10:00",
    ...overrides,
  };
}

describe("isBlogDraftDirty", () => {
  it("is clean when nothing changed", () => {
    expect(isBlogDraftDirty(snapshot(), snapshot())).toBe(false);
  });

  it("ignores surrounding whitespace in text fields", () => {
    expect(isBlogDraftDirty(snapshot({ title: "  My Article  " }), snapshot())).toBe(false);
  });

  it("detects title, slug, excerpt, and cover URL changes", () => {
    expect(isBlogDraftDirty(snapshot({ title: "Other" }), snapshot())).toBe(true);
    expect(isBlogDraftDirty(snapshot({ slug: "other" }), snapshot())).toBe(true);
    expect(isBlogDraftDirty(snapshot({ excerpt: "Other" }), snapshot())).toBe(true);
    expect(
      isBlogDraftDirty(snapshot({ coverUrl: "https://cdn.example.com/cover.jpg" }), snapshot()),
    ).toBe(true);
  });

  it("detects a picked cover file", () => {
    expect(isBlogDraftDirty(snapshot({ hasCoverFile: true }), snapshot())).toBe(true);
  });

  it("detects category, visibility, and publish-date changes", () => {
    expect(isBlogDraftDirty(snapshot({ categories: [] }), snapshot())).toBe(true);
    expect(isBlogDraftDirty(snapshot({ categories: ["Bhakti", "Kirtan"] }), snapshot())).toBe(true);
    expect(isBlogDraftDirty(snapshot({ isPublic: false }), snapshot())).toBe(true);
    expect(isBlogDraftDirty(snapshot({ publishedAt: "2026-09-02T10:00" }), snapshot())).toBe(true);
  });

  it("detects body text changes", () => {
    expect(isBlogDraftDirty(snapshot({ content: "Changed body" }), snapshot())).toBe(true);
  });

  it("treats an empty editor doc the same as an empty body", () => {
    const emptyDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    expect(isBlogDraftDirty(snapshot({ content: emptyDoc }), snapshot({ content: "" }))).toBe(false);
  });

  it("counts formatting-only edits as changes when text is present", () => {
    const plain = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    });
    const bold = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Hello" }] }],
    });
    expect(isBlogDraftDirty(snapshot({ content: bold }), snapshot({ content: plain }))).toBe(true);
  });
});
