// Server-side rich-text HTML handling. Imports sanitize-html (Node-only
// usage here) — NEVER import this module from a client component; the
// browser bundle must not carry the sanitizer. Client-safe helpers live in
// rich-text.ts.

import sanitizeHtml from "sanitize-html";
import { escapeHtml, isRichTextJson, legacyTextToDocJson } from "@/lib/rich-text";

// Mirrors createBlogEditorExtensions(): p, h2-h3, lists, quote, code,
// bold/italic/strike, links. Everything else is stripped on save (h1
// included: the article title owns that level, stray h1s collapse to text).
const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
  "br",
  "strong",
  "em",
  "s",
  "a",
];

/**
 * Sanitize editor-submitted HTML before storage. Fail-closed shape: unknown
 * tags/attributes and non-http(s) link targets are stripped, never trusted.
 */
export function sanitizeRichTextHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = sanitizeHtml(value, {
    allowedTags: RICH_TEXT_ALLOWED_TAGS,
    // transformTags below adds rel/target to links: allow them through so
    // they survive attribute filtering.
    allowedAttributes: { a: ["href", "rel", "target"] },
    // Mirrors isSafeHttpUrl: user links are http(s) only (no javascript:/data:).
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener", target: "_blank" },
      }),
    },
  });
  return clean.trim() || null;
}

/**
 * Resolve display HTML for an article: stored sanitized HTML when present,
 * otherwise the legacy plain-text content escaped into paragraphs. Stored
 * HTML is re-sanitized on read (idempotent): any row that bypassed the
 * writer (legacy data, backfill bug, manual edit) can't become stored XSS.
 */
export function resolveArticleHtml(contentHtml: string | null | undefined, content: string | null | undefined): string {
  if (contentHtml?.trim()) return sanitizeRichTextHtml(contentHtml) ?? "";
  if (content && !isRichTextJson(content)) {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) return "";
    return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  }
  return "";
}

/**
 * Convert a legacy plain-text article body into the editor format: Tiptap
 * JSON in `content` plus sanitized HTML in `contentHtml`. Returns null when
 * there is nothing to convert (empty body or already JSON) — the backfill
 * script and its tests build on this.
 */
export function convertLegacyArticle(
  content: string | null | undefined,
): { content: string; contentHtml: string } | null {
  if (!content?.trim() || isRichTextJson(content)) return null;
  const contentHtml = sanitizeRichTextHtml(resolveArticleHtml(null, content));
  if (!contentHtml) return null;
  return { content: legacyTextToDocJson(content), contentHtml };
}
