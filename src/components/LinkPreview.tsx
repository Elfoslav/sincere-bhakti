"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getFirstUrl } from "@/lib/autolink";
import type { LinkPreviewData } from "@/lib/link-preview";

/**
 * Fetches and renders an Open Graph preview for the first URL in a post's
 * content. The image is served through /api/link-preview/image so the browser
 * CSP (img-src 'self') keeps allowing it without widening to arbitrary hosts.
 * Renders nothing when there is no URL, the fetch fails, or no og data exists.
 */
export default function LinkPreview({ text }: { text: string | null | undefined }) {
  const url = getFirstUrl(text);
  if (!url) return null;
  return <LinkPreviewCard key={url} url={url} />;
}

function LinkPreviewCard({ url }: { url: string }) {
  const t = useTranslations("PostCard");
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
        <p className="text-xs text-deep/40 mt-2 truncate">{preview.siteName ?? t("externalLink")}</p>
      </div>
    </a>
  );
}
