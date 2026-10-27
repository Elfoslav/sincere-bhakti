"use client";

import { useTranslations } from "next-intl";
import ContentComposer from "@/components/ContentComposer";
import AlbumForm from "@/components/AlbumForm";
import type { Album } from "@/types/album";

export default function EditAlbumModal({ album, open, onOpenChange, onSuccess }: {
  album: Album | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (album: Album) => void;
}) {
  const t = useTranslations("Gallery");
  if (!album) return null;
  return <ContentComposer open={open} onOpenChange={onOpenChange} title={t("editTitle")}>
    {({ complete, requestClose, formState }) => <AlbumForm key={album.id} mode="edit" albumId={album.id}
      initialTitle={album.title} initialDescription={album.description ?? ""} initialIsPublic={album.isPublic} initialMedia={album.items}
      {...formState} onCancel={requestClose} onSuccess={(updated) => { onSuccess(updated); complete(); }} />}
  </ContentComposer>;
}
