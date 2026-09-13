/**
 * Unwrap links in excerpt HTML. Cards nest excerpts inside (or next to) their
 * own links, where a nested <a> would be invalid markup with unpredictable
 * parsing — excerpt links lose their affordance but keep their text.
 * DOMParser is client-safe; both consumers are client components.
 */
export function stripExcerptLinks(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("a").forEach((a) => a.replaceWith(...Array.from(a.childNodes)));
    return doc.body.innerHTML;
  } catch {
    // Parser unavailable: strip ALL markup to plain text so no script/img
    // handler can survive into dangerouslySetInnerHTML below.
    return html.replace(/<[^>]*>/g, "");
  }
}
