// Pure, DOM-free rich-text helpers. Safe for client bundles (no tiptap or
// sanitize-html imports here — see rich-text-extensions.ts and
// rich-text-html.ts for those).
import type { JSONContent } from "@tiptap/core";

interface RichTextNode {
  type?: string;
  text?: string;
  content?: RichTextNode[];
}

const BLOCK_CONTAINERS = new Set([
  "doc",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
]);

const MAX_WALK_DEPTH = 100;

/** Parse a stored Tiptap JSON document. Returns null for legacy plain text. */
export function parseRichTextDoc(value: string | null | undefined): { type: string; content: RichTextNode[] } | null {
  if (!value || !value.trim().startsWith("{")) return null;
  try {
    const doc = JSON.parse(value) as { type?: string; content?: RichTextNode[] };
    if (doc?.type === "doc" && Array.isArray(doc.content)) return doc as { type: string; content: RichTextNode[] };
    return null;
  } catch {
    return null;
  }
}

/** True when the stored value is a Tiptap JSON document (not legacy text). */
export function isRichTextJson(value: string | null | undefined): boolean {
  return parseRichTextDoc(value) !== null;
}

/**
 * Convert legacy plain text into a Tiptap JSON document string so old
 * articles open in the editor. Blank lines split paragraphs (as the old
 * whitespace-pre-wrap renderer showed them); single newlines become
 * hardBreaks so they stay soft breaks instead of full paragraphs.
 */
export function legacyTextToDocJson(text: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
  return JSON.stringify({
    type: "doc",
    content: blocks.length > 0
      ? blocks.map((lines) => ({
        type: "paragraph",
        content: lines.flatMap((line, i) =>
          i === 0 ? [{ type: "text", text: line }] : [{ type: "hardBreak" }, { type: "text", text: line }],
        ),
      }))
      : [{ type: "paragraph" }],
  });
}

/**
 * Initial editor content. Tiptap interprets a *string* as HTML, so JSON
 * documents must be passed parsed — handing over the raw string renders the
 * literal markup as article text. Legacy plain text converts first.
 */
export function toEditorContent(value: string | null | undefined): JSONContent | "" {
  if (!value) return "";
  if (isRichTextJson(value)) {
    try {
      return JSON.parse(value) as JSONContent;
    } catch {
      return "";
    }
  }
  return JSON.parse(legacyTextToDocJson(value)) as JSONContent;
}

function collectText(node: RichTextNode, depth: number): string {
  if (depth > MAX_WALK_DEPTH) return "";
  if (typeof node.text === "string") return node.text;
  // Soft line breaks inside a paragraph read as newlines.
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content) ? node.content : [];
  // Block containers (lists, quotes, the doc itself) read as separate lines;
  // inline containers (paragraphs, headings, list items) run together.
  const separator = BLOCK_CONTAINERS.has(node.type ?? "") ? "\n" : "";
  return children.map((child) => collectText(child, depth + 1)).join(separator);
}

/** Plain-text rendering of stored content (JSON doc or legacy text). */
export function extractPlainText(value: string | null | undefined): string {
  if (!value) return "";
  const doc = parseRichTextDoc(value);
  if (!doc) return value;
  return collectText(doc, 0);
}

/**
 * Short plain-text preview for excerpts, meta descriptions, and cards.
 * Word-boundary cut with an ellipsis, mirroring truncateSeoText without
 * pulling server-env helpers into client bundles.
 */
export function previewRichText(value: string | null | undefined, maxLength = 160): string {
  const text = extractPlainText(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength + 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxLength * 0.6) ? sliced.slice(0, lastSpace) : sliced.slice(0, maxLength);
  return `${cut.trim()}...`;
}

/** Escape text for embedding in HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
