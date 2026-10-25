/**
 * Unwrap links in excerpt HTML. Cards nest excerpts inside (or next to) their
 * own links, where a nested <a> would be invalid markup with unpredictable
 * parsing — excerpt links lose their affordance but keep their text.
 * Input must already be sanitized by the server. This is presentation logic,
 * not a sanitizer. Keep it DOM-free so SSR and hydration produce identical
 * markup, including paragraph spacing and inline formatting.
 */
export function stripExcerptLinks(html: string): string {
  // Quoted attribute values may contain `>`; don't stop in their middle.
  return html.replace(/<\/?a\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, "");
}
