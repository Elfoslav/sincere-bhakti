"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadableMedia } from "@/components/ui/loadable-media";
import MediaLightbox from "@/components/ui/MediaLightbox";

export default function VideoGallery({ videos, className }: { videos: { url: string; type: string }[]; className?: string }) {
  const t = useTranslations("MediaLightbox");
  const [index, setIndex] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  if (!videos.length) return null;

  return (
    <div ref={container} className={className}>
      {videos.map((video, i) => (
        <div key={video.url} className="relative mb-2 overflow-hidden rounded-lg bg-black">
          <LoadableMedia showLoading={false}>
            {({ onError }) => (
              <video src={video.url} controls playsInline preload="none" className="w-full max-h-96 object-contain" onError={onError} />
            )}
          </LoadableMedia>
          <Button variant="icon-light" className="absolute top-2 right-2 z-10 h-11 rounded-full bg-black/80 px-3 text-white hover:bg-black" icon={<Maximize />} onClick={() => {
            container.current?.querySelectorAll("video").forEach((element) => element.pause());
            setIndex(i);
          }}>
            {t("expandVideo")}
          </Button>
        </div>
      ))}
      {index !== null && <MediaLightbox images={videos} currentIndex={index} onNavigate={setIndex} onClose={() => setIndex(null)} />}
    </div>
  );
}
