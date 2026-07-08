export interface OgImageCandidate {
  url: string;
  type: string;
  width?: number | null;
  height?: number | null;
}

function isLandscape(m: OgImageCandidate): boolean {
  return (
    typeof m.width === "number" &&
    typeof m.height === "number" &&
    m.height > 0 &&
    m.width >= m.height
  );
}

/**
 * Choose the best image for an Open Graph preview: prefer a landscape (or
 * square) image, falling back to the first image. Selection is independent of
 * the display order, so the user's chosen media order is preserved. Returns
 * null when there are no images.
 */
export function selectOgImageUrl(media: OgImageCandidate[]): string | null {
  const images = media.filter((m) => m.type === "image" && m.url);
  if (images.length === 0) return null;
  return (images.find(isLandscape) ?? images[0]).url;
}
