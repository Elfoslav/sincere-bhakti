import { getFirstUrl } from "@/lib/autolink";

export function parseYouTubeUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    const host = parsed.hostname;
    let id: string | null = null;
    if (host === "youtu.be") id = parsed.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
      id = parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/)?.[1] ?? null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeUrl(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}`;
}

/**
 * True when `text` is nothing but a single YouTube link (the raw URL stays in
 * storage so it stays editable, but on the feed it is redundant with the
 * embedded player LinkPreview shows, so the card hides the text link).
 */
export function isStandaloneYouTubeUrl(text: string | null | undefined): boolean {
  if (!text) return false;
  const url = getFirstUrl(text);
  if (!url) return false;
  if (!getYouTubeEmbedUrl(url)) return false;
  return text.trim() === url;
}
/** Canonical privacy-enhanced player URL; never preserve supplied query parameters. */
export function getPrivateYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeUrl(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
