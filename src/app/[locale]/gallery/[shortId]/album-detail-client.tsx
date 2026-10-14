"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatDisplayDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import ChannelAvatar from "@/components/ChannelAvatar";
import AlbumActions from "@/components/AlbumActions";
import AlbumForm from "@/components/AlbumForm";
import MediaLightbox from "@/components/ui/MediaLightbox";
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
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-deep sm:text-3xl">{album.title}</h1>
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
        <div className="mt-2 flex items-center gap-2 text-xs text-deep/60">
          <ChannelAvatar name={album.channel.name} size="xs" ariaHidden className="shrink-0" />
          <span className="font-medium text-deep/70">{album.channel.name}</span>
          <span aria-hidden>·</span>
          <span>{formatDisplayDate(album.createdAt, locale)}</span>
          <span aria-hidden>·</span>
          <span>{t("itemCount", { count: album.itemCount })}</span>
          {!album.isPublic && (
            <span className="rounded-full bg-deep/10 px-2 py-0.5 text-[11px] font-semibold text-deep/70">
              {t("private")}
            </span>
          )}
        </div>
        {album.description && (
          <p className="mt-3 text-sm text-deep/80 whitespace-pre-wrap">{album.description}</p>
        )}
      </Card>

      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {videos.map((v) => (
            <video
              key={v.url}
              src={v.url}
              controls
              preload="metadata"
              className="w-full rounded-lg bg-black"
            />
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img) => {
            const globalIndex = album.items.findIndex((i) => i.url === img.url);
            return (
              <button
                key={img.url}
                onClick={() => openLightbox(globalIndex)}
                className="relative h-48 sm:h-56 overflow-hidden rounded-lg bg-deep/5 cursor-pointer border-0 p-0"
                aria-label={t("openImage")}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                  unoptimized
                />
              </button>
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

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader text={t("editTitle")} subheading={t("editHint")} />
          <AlbumForm
            mode="edit"
            albumId={album.id}
            initialTitle={album.title}
            initialDescription={album.description ?? ""}
            initialIsPublic={album.isPublic}
            initialMedia={album.items}
            onSuccess={(updated) => {
              setAlbum(updated);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
