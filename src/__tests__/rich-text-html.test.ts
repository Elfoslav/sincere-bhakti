import { describe, it, expect } from "vitest";
import { convertLegacyArticle, resolveArticleHtml, sanitizeRichTextHtml } from "@/lib/rich-text-html";

describe("sanitizeRichTextHtml", () => {
  it("keeps editor formatting and links", () => {
    const html = sanitizeRichTextHtml(
      '<h2>Title</h2><p>Hello <strong>world</strong> <a href="https://example.com">link</a></p><ul><li>one</li></ul><blockquote>quote</blockquote>',
    );
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain('<a href="https://example.com" rel="noopener" target="_blank">link</a>');
    expect(html).toContain("<li>one</li>");
  });

  it("collapses stray h1 tags to text (the title owns that level)", () => {
    expect(sanitizeRichTextHtml("<h1>Title</h1>")).toBe("Title");
  });

  it("strips scripts, event handlers, and dangerous schemes", () => {
    const html = sanitizeRichTextHtml(
      '<p onclick="evil()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a> <a href="data:text/html,y">y</a></p><iframe src="https://evil.example"></iframe>',
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Hi");
  });

  it("returns null for empty input", () => {
    expect(sanitizeRichTextHtml(null)).toBeNull();
    expect(sanitizeRichTextHtml("   ")).toBeNull();
  });
});

describe("resolveArticleHtml", () => {
  it("prefers stored sanitized HTML", () => {
    expect(resolveArticleHtml("<p>Rich</p>", "plain")).toBe("<p>Rich</p>");
  });

  it("renders legacy plain text as escaped paragraphs", () => {
    expect(resolveArticleHtml(null, "Hello <b>world</b>\n\nSecond")).toBe(
      "<p>Hello &lt;b&gt;world&lt;/b&gt;</p><p>Second</p>",
    );
  });

  it("returns empty string when there is nothing to show", () => {
    expect(resolveArticleHtml(null, null)).toBe("");
    expect(resolveArticleHtml("  ", "  ")).toBe("");
  });
});

describe("convertLegacyArticle", () => {
  it("converts plain text to JSON plus sanitized HTML", () => {
    const converted = convertLegacyArticle("Hello <b>world</b>\n\nSecond");
    expect(converted).not.toBeNull();
    expect(JSON.parse(converted!.content).type).toBe("doc");
    expect(converted!.contentHtml).toBe("<p>Hello &lt;b&gt;world&lt;/b&gt;</p><p>Second</p>");
  });

  it("round-trips text through the JSON document", async () => {
    const { extractPlainText } = await import("@/lib/rich-text");
    const converted = convertLegacyArticle("Hello world\n\nSecond line");
    expect(extractPlainText(converted!.content).replace(/\s+/g, " ").trim()).toBe(
      "Hello world Second line",
    );
  });

  it("returns null for empty or already-converted bodies", () => {
    expect(convertLegacyArticle(null)).toBeNull();
    expect(convertLegacyArticle("   ")).toBeNull();
    expect(convertLegacyArticle(JSON.stringify({ type: "doc", content: [] }))).toBeNull();
  });
});
