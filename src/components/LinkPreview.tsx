"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getFirstUrl } from "@/lib/autolink";
import { getYouTubeEmbedUrl } from "@/lib/video";
import type { LinkPreviewData } from "@/lib/link-preview";

/**
 * Renders an Open Graph preview for the first URL in a post's content, or an
 * embedded YouTube player when that URL is a YouTube link. The og:image is
 * served through /api/link-preview/image so the browser CSP (img-src 'self')
 * keeps allowing it without widening to arbitrary hosts. Renders nothing when
 * there is no URL, the fetch fails, or no og data exists.
 *
 * The URL is debounced before fetching: while the user types, getFirstUrl
 * returns partial text (https://exa, https://exampl, …) which would otherwise
 * remount the card and fire a /api/link-preview request per keystroke,
 * exhausting the per-IP rate limit. PostCard text is static so the only cost
 * there is a short delay before the card appears.
 */
export default function LinkPreview({ text }: { text: string | null | undefined }) {
  const [debouncedText, setDebouncedText] = useState(text);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(text), 400);
    return () => clearTimeout(id);
  }, [text]);

  const url = getFirstUrl(debouncedText);
  if (!url) return null;

  // A YouTube link embeds the player directly instead of a card — this is
  // cheap (no fetch, no rate-limit cost) and gives an instant live preview.
  const embedUrl = getYouTubeEmbedUrl(url);
  if (embedUrl) return <YouTubeEmbed key={embedUrl} src={embedUrl} />;

  return <LinkPreviewCard key={url} url={url} />;
}

function YouTubeEmbed({ src }: { src: string }) {
  const t = useTranslations("PostsPage");
  return (
    <div className="mb-3 aspect-video rounded-md overflow-hidden bg-deep/5">
      <iframe
        src={src}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={t("youtubePreview")}
      />
    </div>
  );
}

function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPreview(data?.preview ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!loaded || !preview) return null;

  const imageSrc = preview.image
    ? `/api/link-preview/image?url=${encodeURIComponent(preview.image)}`
    : null;

  // https://www.example.com/path -> www.example.com
  let host: string;
  try {
    host = new URL(preview.url).hostname;
  } catch {
    host = preview.url;
  }

  // Favicons are external arbitrary images, so they're proxied like og:images
  // to stay under the img-src 'self' CSP.
  const faviconSrc = preview.favicon
    ? `/api/link-preview/image?url=${encodeURIComponent(preview.favicon)}`
    : null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-lg border border-sand bg-warm/30 hover:bg-warm/60 transition-colors mb-3"
    >
      {imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- proxied arbitrary remote image; next/image remotePatterns would need every host
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          className="w-full max-h-48 object-cover"
        />
      )}
      <div className="px-4 py-3">
        {preview.title && (
          <p className="text-sm font-semibold text-deep line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-xs text-deep/70 line-clamp-2 mt-1">{preview.description}</p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-deep/40 mt-2">
          {faviconSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- proxied favicon; arbitrary host, must not be fetched directly
            <img src={faviconSrc} alt="" loading="lazy" className="size-3.5 rounded-sm" />
          )}
          <span className="truncate">{host}</span>
        </p>
      </div>
    </a>
  );
}
