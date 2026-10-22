"use client";

import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogActions, dialogActionButtonClassName } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GripVertical, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BYTES_PER_MB, formatBytes } from "@/lib/format";
import { genId } from "@/lib/id";
import { getImageDimensions } from "@/lib/client-media";
import { uploadMediaFiles, cleanupUploadedMedia } from "@/lib/client-upload";
import { isApiErrorCode } from "@/lib/api-error";
import { ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { useIdentity } from "@/components/IdentityProvider";
import type { Album } from "@/types/album";
import type { AlbumMediaInput } from "@/lib/services/album";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_GALLERY_BATCH_SIZE_BYTES,
  MAX_GALLERY_ITEMS_PER_ALBUM,
  MAX_GALLERY_ITEMS_PER_BATCH,
  maxUploadSizeForContentType,
  getAcceptString,
  ALBUM_TITLE_MAX_LENGTH,
} from "@/lib/validation";

interface MediaItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl?: string;
  type: string;
  width?: number;
  height?: number;
}

export interface AlbumFormHandle {
  getValues: () => {
    title: string;
    description: string;
    isPublic: boolean;
    mediaPreviews: { url: string; type: string; width: number | null; height: number | null }[];
  };
}

export interface AlbumFormProps {
  mode: "create" | "edit";
  formId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialMedia?: { url: string; type: string; width?: number | null; height?: number | null }[];
  albumId?: string;
  onSuccess: (album: Album) => void;
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  postingChannel?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

const AlbumForm = forwardRef<AlbumFormHandle, AlbumFormProps>(function AlbumForm({
  mode,
  formId,
  initialTitle = "",
  initialDescription = "",
  initialIsPublic = true,
  initialMedia,
  albumId,
  onSuccess,
  onCancel,
  onSubmittingChange,
  postingChannel,
}, ref) {
  const { data: session } = useSession();
  const { activeIdentity, activeChannelId } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("Gallery");
  const common = useTranslations("Common");

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(
    () =>
      initialMedia?.map((m) => ({
        id: genId(),
        url: m.url,
        type: m.type,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
      })) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItemId = useRef<string | null>(null);
  const postingIdentity = postingChannel ?? activeIdentity;
  const postingChannelId = postingChannel?.id ?? activeChannelId;

  const totalUploadSize = useMemo(
    () => mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0),
    [mediaItems],
  );

  useImperativeHandle(ref, () => ({
    getValues: () => ({
      title,
      description,
      isPublic,
      mediaPreviews: mediaItems.map((m) => ({
        url: m.file ? m.previewUrl! : m.url!,
        type: m.type,
        width: m.width ?? null,
        height: m.height ?? null,
      })),
    }),
  }), [title, description, isPublic, mediaItems]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    // Step 1: reject files that exceed the per-type size limit
    const oversized = selected.filter(
      (f) => f.size > maxUploadSizeForContentType(f.type),
    );
    if (oversized.length > 0) {
      toast.error(
        t("fileTooLarge", {
          imageMax: MAX_IMAGE_SIZE_BYTES / BYTES_PER_MB,
          videoMax: MAX_VIDEO_SIZE_BYTES / BYTES_PER_MB,
        }),
      );
    }

    const valid = selected.filter(
      (f) => f.size <= maxUploadSizeForContentType(f.type),
    );
    if (valid.length === 0) return;

    // Step 2: remove duplicates (same name + size as an already-added file)
    const existingKeys = new Set(
      mediaItems.filter((m) => m.file).map((m) => `${m.file!.name}|${m.file!.size}`),
    );
    const newFiles = valid.filter((f) => !existingKeys.has(`${f.name}|${f.size}`));
    if (newFiles.length < valid.length) {
      toast.warning(t("duplicateMediaSkipped"));
    }
    if (newFiles.length === 0) return;

    // Step 3: verify the album item cap (200 across all edits)
    if (mediaItems.length + newFiles.length > MAX_GALLERY_ITEMS_PER_ALBUM) {
      toast.error(t("tooManyItems", { max: MAX_GALLERY_ITEMS_PER_ALBUM }));
      return;
    }

    // Step 4: verify total pending upload size stays within the gallery batch cap
    const currentTotal = mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0);
    const addedTotal = newFiles.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + addedTotal > MAX_GALLERY_BATCH_SIZE_BYTES) {
      toast.error(t("totalUploadTooLarge"));
      return;
    }

    // Step 5: read dimensions and build media items
    const newItems: MediaItem[] = await Promise.all(
      newFiles.map(async (f) => {
        const dims = await getImageDimensions(f);
        return {
          id: genId(),
          file: f,
          previewUrl: URL.createObjectURL(f),
          type: f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file",
          width: dims?.width,
          height: dims?.height,
        };
      }),
    );

    setMediaItems((prev) => [...prev, ...newItems]);
    if (e.target) e.target.value = "";
  }

  function requestRemoveMedia(id: string) {
    setPendingRemoveId(id);
  }

  function confirmRemoveMedia() {
    if (!pendingRemoveId) return;
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  }

  const handleDragStart = useCallback((id: string) => {
    dragItemId.current = id;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragItemId.current === null) return;
    setMediaItems((prev) => {
      const fromIndex = prev.findIndex((m) => m.id === dragItemId.current);
      if (fromIndex === -1 || fromIndex === targetIndex) return prev;
      const items = [...prev];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(targetIndex, 0, moved);
      return items;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItemId.current = null;
  }, []);

  // Upload new files in chunks of MAX_GALLERY_ITEMS_PER_BATCH so a large
  // selection never exceeds the per-request presigned-URL cap. Chunks run
  // sequentially so a failure stops before minting more URLs.
  async function uploadNewFiles(
    targetAlbumId: string,
    newItems: { file: File; width?: number; height?: number }[],
  ): Promise<{ uploaded: AlbumMediaInput[]; error: string | null }> {
    const uploaded: AlbumMediaInput[] = [];
    for (let i = 0; i < newItems.length; i += MAX_GALLERY_ITEMS_PER_BATCH) {
      const chunk = newItems.slice(i, i + MAX_GALLERY_ITEMS_PER_BATCH);
      const { media, error } = await uploadMediaFiles(
        targetAlbumId,
        chunk,
        mode === "create" ? postingChannelId ?? undefined : undefined,
        "gallery",
      );
      uploaded.push(...media);
      if (error) return { uploaded, error };
    }
    return { uploaded, error: null };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      toast.error(t("titleRequired"));
      return;
    }
    if (!trimmedDescription && mediaItems.length === 0) {
      toast.error(t("nothingToSave"));
      return;
    }

    setSubmitting(true);
    onSubmittingChange?.(true);

    const targetAlbumId = mode === "create" ? crypto.randomUUID() : albumId!;

    try {
      const newFileItems = mediaItems.filter((m) => m.file).map((m) => ({ file: m.file!, width: m.width, height: m.height }));
      const { uploaded, error: uploadError } = await uploadNewFiles(targetAlbumId, newFileItems);
      if (uploadError) {
        await cleanupUploadedMedia(uploaded.map((m) => m.url));
        throw new Error(uploadError);
      }

      const media: AlbumMediaInput[] = [];
      let uploadIdx = 0;
      for (const item of mediaItems) {
        if (item.file) {
          media.push(uploaded[uploadIdx]);
          uploadIdx++;
        } else if (item.url) {
          media.push({
            url: item.url,
            type: item.type,
            width: item.width,
            height: item.height,
          });
        }
      }

      const url = mode === "edit" && albumId ? `/api/albums/${albumId}` : "/api/albums";
      const method = mode === "edit" ? "PATCH" : "POST";
      const body: Record<string, unknown> = mode === "create"
        ? {
            id: targetAlbumId,
            title: trimmedTitle,
            description: trimmedDescription || undefined,
            isPublic,
            language: locale,
            channelId: postingChannelId ?? undefined,
            media: media.length > 0 ? media : undefined,
          }
        : {
            title: trimmedTitle,
            description: trimmedDescription || null,
            isPublic,
            media,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const album: Album = await res.json();
        setTitle("");
        setDescription("");
        setMediaItems((prev) => {
          prev.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
          return [];
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success(mode === "edit" ? t("albumUpdated") : t("albumPublished"));
        onSuccess(album);
      } else {
        await cleanupUploadedMedia(uploaded.map((m) => m.url));
        if (res.status === 429 || isApiErrorCode(await res.json().catch(() => ({})), ERROR_TOO_MANY_REQUESTS)) {
          toast.error(common("tooManyRequests"));
        } else {
          toast.error(mode === "edit" ? t("updateFailed") : t("createFailed"));
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "rate_limited") {
          toast.error(t("uploadRateLimited"));
        } else if (err.message === "upload_failed") {
          toast.error(t("uploadFailed"));
        } else {
          toast.error(mode === "edit" ? t("updateFailed") : t("createFailed"));
        }
      } else {
        toast.error(mode === "edit" ? t("updateFailed") : t("createFailed"));
      }
    }

    setSubmitting(false);
    onSubmittingChange?.(false);
  }

  const pendingRemoveName = pendingRemoveId
    ? (mediaItems.find((m) => m.id === pendingRemoveId)?.file?.name
      ?? mediaItems.find((m) => m.id === pendingRemoveId)?.url?.split("/").pop()
      ?? "")
    : "";

  return (
    <>
      <form onSubmit={handleSubmit} id={formId}>
        {mode === "create" && postingIdentity && (
          <div className="mb-3 flex items-center gap-2 text-sm text-deep/60">
            <span>{t("postingAs")}</span>
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-deep/5 py-1 pl-1 pr-3 font-medium text-deep">
              {postingIdentity.avatarUrl ? (
                <img src={postingIdentity.avatarUrl} alt="" className="size-5 rounded-full object-cover" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-gold/20 text-xs text-gold">
                  {postingIdentity.name?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <span className="truncate">{postingIdentity.name}</span>
            </span>
          </div>
        )}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={ALBUM_TITLE_MAX_LENGTH}
          aria-label={t("titlePlaceholder")}
        />

        <div className="mt-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            size="compose"
            autoResize
          />
        </div>

        {mediaItems.length > 0 && (
          <div className="mt-3 space-y-2">
            {mediaItems.map((item, i) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className="relative group flex items-center gap-2 bg-deep/5 rounded-md p-1 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-4 h-4 text-deep/30 shrink-0" />
                <div className="w-16 h-12 rounded overflow-hidden shrink-0 bg-deep/10">
                  {(item.file ? item.previewUrl : item.url) && (
                    item.file?.type.startsWith("video/") || item.type.startsWith("video") ? (
                      <video src={item.file ? item.previewUrl : item.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.file ? item.previewUrl! : item.url!} alt="" className="w-full h-full object-cover" />
                    )
                  )}
                </div>
                <span className="text-xs text-deep/60 truncate flex-1 min-w-0 hidden md:block">
                  {item.file ? item.file.name : item.url?.split("/").pop()}
                </span>
                {item.file && (
                  <span className="text-[10px] text-deep/40 shrink-0 tabular-nums">
                    {formatBytes(item.file.size)}
                  </span>
                )}
                <Button
                  type="button"
                  onClick={() => requestRemoveMedia(item.id)}
                  variant="icon-destructive"
                  size="icon-xs"
                  className="ml-auto text-deep/30"
                  aria-label={t("removeMedia")}
                  icon={<X />}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <label className="flex items-center gap-2 text-sm text-deep/70 cursor-pointer hover:text-deep">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={getAcceptString()}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="text-xl">📎</span>
                {mediaItems.length > 0 ? `${t("attachMedia")} (${mediaItems.length})` : t("attachMedia")}
              </label>
              {totalUploadSize > 0 && (
                <>
                  <span className="text-[11px] text-deep/40 ml-8 tabular-nums">
                    {formatBytes(totalUploadSize)} / {formatBytes(MAX_GALLERY_BATCH_SIZE_BYTES)}
                  </span>
                  <div className="ml-8 w-28 h-1.5 rounded-full bg-deep/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((totalUploadSize / MAX_GALLERY_BATCH_SIZE_BYTES) * 100, 100)}%`,
                        backgroundColor: totalUploadSize > MAX_GALLERY_BATCH_SIZE_BYTES * 0.9 ? "#ef4444" : "#db8637",
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <Switch
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked)}
              />
              <span className="text-sm font-medium">
                {isPublic ? (
                  <span className="text-tulsi">{t("public")}</span>
                ) : (
                  <span className="text-saffron">{t("private")}</span>
                )}
              </span>
            </label>
          </div>

          <DialogActions className={onCancel ? undefined : "flex grid-cols-none items-center justify-end"}>
            {onCancel && (
              <Button type="button" variant="outline" className={dialogActionButtonClassName} onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
            <Button
              type="submit"
              variant="default"
              className={onCancel ? dialogActionButtonClassName : "px-6 py-2"}
              disabled={submitting || (mode === "create" && !activeChannelId) || (!title.trim() || (!description.trim() && mediaItems.length === 0))}
            >
              {submitting
                ? t("saving")
                : mode === "edit"
                  ? t("saveButton")
                  : t("createButton")}
            </Button>
          </DialogActions>
        </div>
      </form>
      <ConfirmDialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => { if (!open) setPendingRemoveId(null); }}
        title={t("removeMediaTitle")}
        description={t("removeMediaConfirm", { name: pendingRemoveName })}
        confirmLabel={t("removeMediaConfirmLabel")}
        cancelLabel={t("cancel")}
        onConfirm={confirmRemoveMedia}
        variant="destructive"
      />
    </>
  );
});

export default AlbumForm;
