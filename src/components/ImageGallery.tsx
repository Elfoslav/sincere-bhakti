"use client";

import { useState } from "react";
import MediaLightbox from "@/components/ui/MediaLightbox";

const MAX_VISIBLE = 4;

export default function ImageGallery({
  images,
  t,
}: {
  images: { url: string }[];
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const visible = images.slice(0, MAX_VISIBLE);
  const overflowCount = images.length - MAX_VISIBLE;

  function gridClass(): string {
    if (images.length === 1) return "grid-cols-1";
    if (images.length === 2) return "grid-cols-2";
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
          return (
            <button
              key={img.url}
              onClick={() => setLightboxIndex(i)}
              className={`relative p-0 border-0 cursor-pointer overflow-hidden ${cellClass(i)}`}
              aria-label={t("openImage")}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
                style={
                  images.length === 1
                    ? { maxHeight: 440 }
                    : { height: 200 }
                }
              />
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
