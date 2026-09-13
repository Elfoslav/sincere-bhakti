/**
 * Copies text to the clipboard. Returns `true` on success, `false` otherwise —
 * never throws, so callers can branch on the result to show a toast.
 *
 * `navigator.clipboard` only exists in secure contexts (https, localhost), so
 * on plain-http LAN dev URLs (e.g. opening `next dev` from a phone) it is
 * `undefined` and a direct `writeText` call throws a TypeError. In that case
 * (or when the async write is rejected) we fall back to the legacy hidden
 * textarea + `execCommand("copy")` path, which works in non-secure contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API unavailable or write rejected — try the legacy fallback.
  }
  return copyTextLegacy(text);
}

function copyTextLegacy(text: string): boolean {
  try {
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    try {
      textarea.select();
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  } catch {
    return false;
  }
}
