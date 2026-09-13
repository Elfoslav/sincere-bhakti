import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  extractPlainText,
  isRichTextJson,
  legacyTextToDocJson,
  parseRichTextDoc,
  previewRichText,
  toEditorContent,
} from "@/lib/rich-text";

const doc = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", marks: [{ type: "bold" }], text: "world" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
      ],
    },
  ],
});

describe("parseRichTextDoc", () => {
  it("parses Tiptap JSON documents", () => {
    expect(parseRichTextDoc(doc)?.type).toBe("doc");
  });

  it("returns null for legacy plain text and garbage", () => {
    expect(parseRichTextDoc("Just some text")).toBeNull();
    expect(parseRichTextDoc("")).toBeNull();
    expect(parseRichTextDoc(null)).toBeNull();
    expect(parseRichTextDoc("{not json")).toBeNull();
    expect(parseRichTextDoc('{"type":"paragraph"}')).toBeNull();
  });
});

describe("isRichTextJson", () => {
  it("distinguishes JSON docs from text", () => {
    expect(isRichTextJson(doc)).toBe(true);
    expect(isRichTextJson("plain")).toBe(false);
  });
});

describe("extractPlainText", () => {
  it("extracts text across blocks with line breaks", () => {
    const text = extractPlainText(doc);
    expect(text).toContain("Title");
    expect(text).toContain("Hello world");
    expect(text).toContain("one");
    expect(text).toContain("two");
  });

  it("renders hard breaks as newlines", () => {
    const withBreak = JSON.stringify({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "one" },
          { type: "hardBreak" },
          { type: "text", text: "two" },
        ],
      }],
    });
    expect(extractPlainText(withBreak)).toBe("one\ntwo");
  });

  it("passes legacy plain text through", () => {
    expect(extractPlainText("Hello\nworld")).toBe("Hello\nworld");
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
  });

  it("survives hostile nesting without hanging", () => {
    let node: any = { type: "text", text: "x" };
    for (let i = 0; i < 500; i++) node = { type: "paragraph", content: [node] };
    expect(() => extractPlainText(JSON.stringify({ type: "doc", content: [node] }))).not.toThrow();
  });
});

describe("previewRichText", () => {
  it("collapses JSON docs to a single line", () => {
    expect(previewRichText(doc, 1000)).toBe("Title Hello world one two");
  });

  it("cuts on word boundaries with an ellipsis", () => {
    expect(previewRichText("Hare Krishna dear devotees and friends", 24)).toBe("Hare Krishna dear...");
  });

  it("returns short text untouched", () => {
    expect(previewRichText("Hi")).toBe("Hi");
  });
});

describe("legacyTextToDocJson", () => {
  it("wraps blank-line-separated blocks into paragraphs", () => {
    const parsed = JSON.parse(legacyTextToDocJson("one\n\ntwo"));
    expect(parsed.type).toBe("doc");
    expect(parsed.content).toHaveLength(2);
    expect(parsed.content[0].content[0].text).toBe("one");
  });

  it("keeps single newlines as soft breaks inside one paragraph", () => {
    const parsed = JSON.parse(legacyTextToDocJson("one\ntwo"));
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0].content).toEqual([
      { type: "text", text: "one" },
      { type: "hardBreak" },
      { type: "text", text: "two" },
    ]);
  });

  it("produces an empty paragraph for blank input", () => {
    const parsed = JSON.parse(legacyTextToDocJson("   "));
    expect(parsed.content).toEqual([{ type: "paragraph" }]);
  });
});

describe("toEditorContent", () => {
  it("parses stored JSON into a document object (strings would render as HTML text)", () => {
    const content = toEditorContent(doc);
    expect(typeof content).toBe("object");
    expect((content as { type?: string }).type).toBe("doc");
  });

  it("converts legacy text into a document object", () => {
    const content = toEditorContent("hi") as { type?: string };
    expect(content.type).toBe("doc");
  });

  it("returns empty content for blank input", () => {
    expect(toEditorContent("")).toBe("");
    expect(toEditorContent(null)).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes tag-significant characters", () => {
    expect(escapeHtml('<a href="x">&\'')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});
