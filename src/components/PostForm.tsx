"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getYouTubeEmbedUrl } from "@/lib/video";
import { formatBytes } from "@/lib/format";
import { genId } from "@/lib/id";
import { getImageDimensions } from "@/lib/client-media";
import { uploadMediaFiles, cleanupUploadedMedia } from "@/lib/client-upload";
import type { Post } from "@/types/post";
import type { MediaInput } from "@/lib/services/post";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_TOTAL_UPLOAD_SIZE_BYTES,
  maxUploadSizeForContentType,
  getAcceptString,
} from "@/lib/validation";

const BYTES_PER_MB = 1024 * 1024;

interface MediaItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl?: string;
  type: string;
  width?: number;
  height?: number;
}

export interface PostFormProps {
  mode: "create" | "edit";
  initialContent?: string;
  initialIsPublic?: boolean;
  initialMedia?: { url: string; type: string; width?: number | null; height?: number | null }[];
  postId?: string;
  onSuccess: (post: Post) => void;
  onCancel?: () => void;
}

export default function PostForm({
  mode,
  initialContent = "",
  initialIsPublic = true,
  initialMedia,
  postId,
  onSuccess,
  onCancel,
}: PostFormProps) {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("PostsPage");
  const [content, setContent] = useState(initialContent);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItemId = useRef<string | null>(null);

  const totalUploadSize = useMemo(
    () => mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0),
    [mediaItems],
  );
  const newFileCount = useMemo(
    () => mediaItems.filter((item) => item.file).length,
    [mediaItems],
  );

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

    // Step 3: verify total upload size stays within limits
    const currentTotal = mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0);
    const addedTotal = newFiles.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + addedTotal > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      toast.error(t("totalUploadTooLarge"));
      return;
    }

    // Step 4: read dimensions and build media items
    const newItems: MediaItem[] = await Promise.all(
      newFiles.map(async (f) => {
        const dims = await getImageDimensions(f);
        return {
          id: genId(),
          file: f,
          previewUrl: URL.createObjectURL(f),
          type: f.type,
          width: dims?.width,
          height: dims?.height,
        };
      }),
    );

    setMediaItems((prev) => [...prev, ...newItems]);
    if (e.target) e.target.value = "";
  }

  function removeMedia(id: string) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const trimmed = content.trim();
    if (!trimmed && mediaItems.length === 0) {
      toast.error(t("nothingToPost"));
      return;
    }

    setSubmitting(true);

    const youtubeUrl = getYouTubeEmbedUrl(trimmed);
    const postContent = youtubeUrl
      ? trimmed.replace(/https?:\/\/\S*(?:youtube\.com|youtu\.be)\S*/gi, "").trim()
      : trimmed;

    const targetPostId = mode === "create" ? crypto.randomUUID() : postId!;

    try {
      const { media: uploaded, error: uploadError } = await uploadMediaFiles(
        targetPostId,
        mediaItems.filter((m) => m.file).map((m) => ({ file: m.file!, width: m.width, height: m.height })),
      );
      if (uploadError) {
        await cleanupUploadedMedia(uploaded.map((m) => m.url));
        throw new Error(uploadError);
      }

      const media: MediaInput[] = [];

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

      if (youtubeUrl) {
        media.push({ url: youtubeUrl, type: "youtube" });
      }

      const url = mode === "edit" && postId ? `/api/posts/${postId}` : "/api/posts";
      const method = mode === "edit" ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        id: mode === "create" ? targetPostId : undefined,
        content: mode === "edit" ? (postContent || null) : (postContent || undefined),
        isPublic,
        language: mode === "create" ? locale : undefined,
        media: mode === "edit" ? media : (media.length > 0 ? media : undefined),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const post: Post = await res.json();
        setContent("");
        setMediaItems((prev) => {
          prev.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
          return [];
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success(mode === "edit" ? t("postUpdated") : t("postPublished"));
        onSuccess(post);
      } else {
        await cleanupUploadedMedia(uploaded.map((m) => m.url));
        const body = await res.json().catch(() => ({}));
        const err = body?.error ?? "";
        if (err === "validation_error:input:custom") {
          toast.error(t("nothingToPost"));
        } else {
          toast.error(mode === "edit" ? t("updatePostFailed") : t("createPostFailed"));
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "rate_limited") {
          toast.error(t("uploadRateLimited"));
        } else if (err.message === "upload_failed") {
          toast.error(t("uploadFailed"));
        } else {
          toast.error(mode === "edit" ? t("updatePostFailed") : t("createPostFailed"));
        }
      } else {
        toast.error(mode === "edit" ? t("updatePostFailed") : t("createPostFailed"));
      }
    }

    setSubmitting(false);
  }

  const detectedVideo = mediaItems.length === 0
    ? getYouTubeEmbedUrl(content)
    : null;

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={mode === "edit" ? undefined : t("composePlaceholder")}
        rows={3}
      />

      {detectedVideo && (
        <div className="mt-3 aspect-video rounded-md overflow-hidden bg-deep/5">
          <iframe
            key={detectedVideo}
            src={detectedVideo}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={t("youtubePreview")}
          />
        </div>
      )}

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
              <span className="text-xs text-deep/60 truncate flex-1">
                {item.file ? item.file.name : item.url?.split("/").pop()}
              </span>
              {item.file && (
                <span className="text-[10px] text-deep/40 shrink-0 tabular-nums">
                  {formatBytes(item.file.size)}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeMedia(item.id)}
                className="text-deep/30 hover:text-red-500 transition-colors p-1"
              >
                ✕
              </button>
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
                  {formatBytes(totalUploadSize)} / {formatBytes(MAX_TOTAL_UPLOAD_SIZE_BYTES)}
                </span>
                <div className="ml-8 w-28 h-1.5 rounded-full bg-deep/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((totalUploadSize / MAX_TOTAL_UPLOAD_SIZE_BYTES) * 100, 100)}%`,
                      backgroundColor: totalUploadSize > MAX_TOTAL_UPLOAD_SIZE_BYTES * 0.9 ? "#ef4444" : "#db8637",
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

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
          <Button
            type="submit"
            variant="default"
            className="px-6 py-2"
            disabled={submitting || (!content.trim() && mediaItems.length === 0)}
          >
            {submitting
              ? t("posting")
              : mode === "edit"
                ? t("saveButton")
                : t("postButton")}
          </Button>
        </div>
      </div>
    </form>
  );
}
