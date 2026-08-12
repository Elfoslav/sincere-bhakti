import { getFirstUrl } from "@/lib/autolink";

export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
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