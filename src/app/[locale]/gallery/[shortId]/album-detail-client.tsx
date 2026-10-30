"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import VideoGallery from "@/components/VideoGallery";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatDisplayDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import ChannelAvatar from "@/components/ChannelAvatar";
import AlbumActions from "@/components/AlbumActions";
import EditAlbumModal from "@/components/EditAlbumModal";
import MediaLightbox from "@/components/ui/MediaLightbox";
import { LoadableMedia } from "@/components/ui/loadable-media";
import { useIdentity } from "@/components/IdentityProvider";
import type { Album } from "@/types/album";

export default function AlbumDetailClient({ album: initial }: { album: Album }) {
  const [album, setAlbum] = useState(initial);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const { data: session } = useSession();
  const { identities } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("Gallery");
  const router = useRouter();
  const manageableChannelIds = identities.map((i) => i.id);

  const images = album.items.filter((i) => i.type === "image");
  const videos = album.items.filter((i) => i.type === "video");

  const openLightbox = useCallback((itemIndex: number) => {
    const item = album.items[itemIndex];
    const imageIndex = images.findIndex((img) => img.url === item.url);
    if (imageIndex >= 0) setLightboxIndex(imageIndex);
  }, [album.items, images]);

  function handleDelete() {
    router.push("/gallery");
  }

  return (
    <div className="reading-container page-space flex flex-col gap-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="type-title min-w-0">{album.title}</h1>
          <div className="shrink-0 -mr-1 -mt-1">
            <AlbumActions
              album={album}
              currentUserId={session?.user?.id}
              manageableChannelIds={manageableChannelIds}
              onDelete={handleDelete}
              onEdit={() => setEditing(true)}
            />
          </div>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ChannelAvatar name={album.channel.name} size="xs" ariaHidden className="shrink-0" />
          <span className="min-w-0 max-w-full break-words font-medium text-muted-foreground">{album.channel.name}</span>
          <span aria-hidden>·</span>
          <span>{formatDisplayDate(album.createdAt, locale)}</span>
          <span aria-hidden>·</span>
          <span>{t("itemCount", { count: album.itemCount })}</span>
          {!album.isPublic && (
            <span className="rounded-full bg-deep/10 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {t("private")}
            </span>
          )}
        </div>
        {album.description && (
          <p className="mt-3 break-words text-sm text-deep/80 whitespace-pre-wrap">{album.description}</p>
        )}
      </Card>

      <VideoGallery videos={videos} className="grid grid-cols-1 sm:grid-cols-2 gap-3" />

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img) => {
            const globalIndex = album.items.findIndex((i) => i.url === img.url);
            return (
              <LoadableMedia
                key={img.url}
                className="h-48 sm:h-56 overflow-hidden rounded-lg bg-deep/5"
              >
                {({ ref, onLoad, onError }) => (
                  <button
                    onClick={() => openLightbox(globalIndex)}
                    className="relative h-full w-full cursor-pointer overflow-hidden border-0 p-0"
                    aria-label={t("openImage")}
                  >
                    <Image
                      ref={ref}
                      onLoad={onLoad}
                      onError={onError}
                      src={img.url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                )}
              </LoadableMedia>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      <EditAlbumModal album={album} open={editing} onOpenChange={setEditing} onSuccess={setAlbum} />
    </div>
  );
}
