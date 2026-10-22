"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link as LinkIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAlbumUrl } from "@/lib/album-url";
import { isAlbumManager } from "@/lib/album";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Album } from "@/types/album";

/**
 * Edit/delete/copy-link buttons for a gallery album, with the delete
 * confirmation dialog. Renders nothing unless the viewer may manage the
 * album's channel and at least one action callback is provided. Shared by
 * the gallery card and the detail header so the logic lives in one place.
 */
export default function AlbumActions({
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
  const commonT = useTranslations("Common");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canManage = isAlbumManager(album, currentUserId, manageableChannelIds);

  const handleCopyLink = useCallback(async () => {
    const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const url = `${window.location.origin}${localePrefix}${getAlbumUrl(album.shortId, album.slug)}`;
    if (await copyTextToClipboard(url)) {
      toast.success(t("linkCopied"));
    } else {
      toast.error(t("linkCopyFailed"));
    }
  }, [locale, album.shortId, album.slug, t]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/albums/${album.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("deleteFailed"));
        setShowDeleteConfirm(false);
        return;
      }
      toast.success(t("deleteSuccess"));
      setShowDeleteConfirm(false);
      onDelete?.(album.id);
    } catch {
      toast.error(t("deleteFailed"));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [album.id, t, onDelete]);

  if (!canManage || (!onEdit && !onDelete)) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {onEdit ? (
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label={t("editAlbum")}
            title={t("editAlbum")}
            onClick={() => onEdit(album.id)}
            icon={<Pencil className="size-4" />}
          />
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label={t("delete")}
            title={t("delete")}
            onClick={() => setShowDeleteConfirm(true)}
            icon={<Trash2 className="size-4" />}
          />
        ) : null}
        <Button
          type="button"
          variant="icon"
          size="icon"
          aria-label={t("copyLink")}
          title={t("copyLink")}
          onClick={handleCopyLink}
          icon={<LinkIcon className="size-4" />}
        />
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("delete")}
        description={t("deleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={commonT("cancel")}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        loading={isDeleting}
      />
    </>
  );
}
