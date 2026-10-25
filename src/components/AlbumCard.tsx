"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getAlbumUrl } from "@/lib/album-url";
import { formatDisplayDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import ChannelAvatar from "@/components/ChannelAvatar";
import AlbumActions from "@/components/AlbumActions";
import type { Album } from "@/types/album";

export default function AlbumCard({
  album,
  currentUserId,
  manageableChannelIds,
  onDelete,
  onEdit,
}: {
  album: Album;
  currentUserId?: string;
  manageableChannelIds?: string[];
  onDelete?: (id: string) => void;
  onEdit?: (albumId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("Gallery");
  const date = formatDisplayDate(album.createdAt, locale);
  const cover = album.coverUrl ?? album.items[0]?.url ?? null;
  const isCoverVideo = !album.coverUrl && album.items[0]?.type === "video";

  return (
    <Card variant="editorial" className="py-7">
      <div className="flex items-start justify-between gap-3">
        <Link href={getAlbumUrl(album.shortId, album.slug)} className="min-w-0 flex-1 text-deep hover:text-gold transition-colors">
          <h3 className="font-heading text-xl leading-tight line-clamp-2 sm:text-[22px]">
            {album.title}
          </h3>
        </Link>
        <div className="shrink-0 -mr-1 -mt-1">
          <AlbumActions
            album={album}
            currentUserId={currentUserId}
            manageableChannelIds={manageableChannelIds}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </div>
      </div>

      <div className="mt-2 flex gap-4 items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <ChannelAvatar name={album.channel.name} size="xs" ariaHidden className="shrink-0" />
            <span className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-0.5 flex-wrap text-xs text-muted-foreground">
              <span className="min-w-0 max-w-full truncate font-medium text-muted-foreground">
                {album.channel.name}
              </span>
              <span className="shrink-0 text-deep/30" aria-hidden>
                ·
              </span>
              <span className="shrink-0 whitespace-nowrap">{date}</span>
              <span className="shrink-0 text-deep/30" aria-hidden>
                ·
              </span>
              <span className="shrink-0 whitespace-nowrap">{t("itemCount", { count: album.itemCount })}</span>
            </span>
            {!album.isPublic && (
              <span className="shrink-0 rounded-full bg-deep/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground">
                {t("private")}
              </span>
            )}
          </div>
          {album.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{album.description}</p>
          )}
        </div>
        {cover && !isCoverVideo && (
          <Link
            href={getAlbumUrl(album.shortId, album.slug)}
            className="relative block h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-deep/5"
            aria-label={t("openAlbum")}
          >
            <Image
              src={cover}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
              unoptimized
            />
          </Link>
        )}
      </div>
    </Card>
  );
}
