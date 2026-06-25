const YT_EXTRACT =
  /https?:\/\/\S*(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})\S*/gi;

export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
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

export function extractYouTubeContent(
  text: string | null,
): { cleanContent: string | null; embedUrl: string | null } {
  if (!text) return { cleanContent: null, embedUrl: null };

  const match = text.match(YT_EXTRACT);
  const url = match?.[0] ?? null;
  if (!url) return { cleanContent: text, embedUrl: null };

  return {
    cleanContent: text.replace(YT_EXTRACT, "").trim() || null,
    embedUrl: getYouTubeEmbedUrl(url),
  };
}
