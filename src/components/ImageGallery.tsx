"use client";

import { useState } from "react";
import Image from "next/image";
import MediaLightbox from "@/components/ui/MediaLightbox";
import { LoadableMedia } from "@/components/ui/loadable-media";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 4;

type GalleryImage = { url: string; width?: number | null; height?: number | null };

export default function ImageGallery({
  images,
  t,
  variant = "default",
}: {
  images: GalleryImage[];
  variant?: "default" | "compact";
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
      <div className={cn(`grid ${gridClass()} gap-0.5 rounded-lg overflow-hidden mb-2`, variant === "compact" && !single && "aspect-square auto-rows-fr")}>
        {visible.map((img, i) => {
          const isLastOverflow = i === MAX_VISIBLE - 1 && overflowCount > 0;
          const dims = img.width && img.height ? { width: img.width, height: img.height } : null;
          return (
            <LoadableMedia
              key={img.url}
              className={`overflow-hidden bg-deep/5 ${cellClass(i)}`}
              style={variant === "compact" ? single ? { aspectRatio: "1.12", minHeight: 80 } : { minHeight: 0 } : single ? undefined : { height: 200 }}
            >
              {({ ref, onLoad, onError }) => (
                <button
                  onClick={() => setLightboxIndex(i)}
                  className="relative block h-full w-full cursor-pointer overflow-hidden border-0 p-0"
                  aria-label={t("openImage")}
                >
                  {single && dims && variant !== "compact" ? (
                    // Single image with known dimensions: responsive, intrinsic
                    // aspect capped at 440px tall. next/image serves a right-sized
                    // AVIF/WebP and lazy-loads by default.
                    <Image
                      ref={ref}
                      onLoad={onLoad}
                      onError={onError}
                      src={img.url}
                      alt=""
                      width={dims.width}
                      height={dims.height}
                      sizes="(max-width: 768px) 100vw, 640px"
                      className="w-full object-cover"
                      style={{ width: "100%", height: "auto", maxHeight: 440 }}
                      unoptimized
                    />
                  ) : dims || !single || variant === "compact" ? (
                    // Grid cell (fixed-height container) — fill + cover.
                    <Image
                      ref={ref}
                      onLoad={onLoad}
                      onError={onError}
                      src={img.url}
                      alt=""
                      fill
                      sizes={variant === "compact" ? "(max-width: 639px) 35vw, 240px" : "(max-width: 768px) 50vw, 320px"}
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    // Legacy single image without stored dimensions: plain lazy img.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      ref={ref}
                      onLoad={onLoad}
                      onError={onError}
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
              )}
            </LoadableMedia>
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
