"use client";

import { useState } from "react";
import Image from "next/image";
import MediaLightbox from "@/components/ui/MediaLightbox";

const MAX_VISIBLE = 4;

type GalleryImage = { url: string; width?: number | null; height?: number | null };

export default function ImageGallery({
  images,
  t,
}: {
  images: GalleryImage[];
  t: (key: string, params?: Record<string, string | number | Date>) => string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const visible = images.slice(0, MAX_VISIBLE);
  const overflowCount = images.length - MAX_VISIBLE;
  const single = images.length === 1;

  function gridClass(): string {
    if (images.length === 1) return "grid-cols-1";
    return "grid-cols-2";
  }

  function cellClass(index: number): string {
    if (images.length === 3 && index === 0) return "row-span-2";
    return "";
  }

  return (
    <>
      <div className={`grid ${gridClass()} gap-0.5 rounded-lg overflow-hidden mb-2`}>
        {visible.map((img, i) => {
          const isLastOverflow = i === MAX_VISIBLE - 1 && overflowCount > 0;
          const dims = img.width && img.height ? { width: img.width, height: img.height } : null;
          return (
            <button
              key={img.url}
              onClick={() => setLightboxIndex(i)}
              className={`relative p-0 border-0 cursor-pointer overflow-hidden bg-deep/5 ${cellClass(i)}`}
              style={single ? undefined : { height: 200 }}
              aria-label={t("openImage")}
            >
              {single && dims ? (
                // Single image with known dimensions: responsive, intrinsic
                // aspect capped at 440px tall. next/image serves a right-sized
                // AVIF/WebP and lazy-loads by default.
                <Image
                  src={img.url}
                  alt=""
                  width={dims.width}
                  height={dims.height}
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="w-full object-cover"
                  style={{ width: "100%", height: "auto", maxHeight: 440 }}
                  unoptimized
                />
              ) : dims || !single ? (
                // Grid cell (fixed-height container) — fill + cover.
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 320px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                // Legacy single image without stored dimensions: plain lazy img.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                  style={{ maxHeight: 440 }}
                />
              )}
              {isLastOverflow && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">+{overflowCount}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
