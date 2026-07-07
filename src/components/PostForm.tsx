"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical } from "lucide-react";
import { getYouTubeEmbedUrl } from "@/lib/video";
import type { Post } from "@/types/post";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_TOTAL_UPLOAD_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  IMAGE_JPEG_QUALITY,
  maxUploadSizeForContentType,
  getAcceptString,
} from "@/lib/validation";

const BYTES_PER_MB = 1024 * 1024;

type MediaInput = {
  url: string;
  type: string;
  width?: number;
  height?: number;
};

interface MediaItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl?: string;
  type: string;
  width?: number;
  height?: number;
}

const DIMENSION_TIMEOUT_MS = 10_000;

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Reads an image file's intrinsic dimensions locally (no network). Resolves
// null for non-images, undecodable files, or if it stalls past the timeout —
// so orientation is simply treated as unknown rather than blocking submit.
function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timer = setTimeout(() => finish(null), DIMENSION_TIMEOUT_MS);
    function finish(result: { width: number; height: number } | null) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    }
    img.onload = () => finish({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => finish(null);
    img.src = url;
  });
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

    const withinPerFileLimit = selected.filter(
      (f) => f.size <= maxUploadSizeForContentType(f.type),
    );
    if (withinPerFileLimit.length < selected.length) {
      toast.error(
        t("fileTooLarge", {
          imageMax: MAX_IMAGE_SIZE_BYTES / BYTES_PER_MB,
          videoMax: MAX_VIDEO_SIZE_BYTES / BYTES_PER_MB,
        }),
      );
    }
    if (withinPerFileLimit.length === 0) return;

    const existingKeys = new Set(
      mediaItems.filter((m) => m.file).map((m) => `${m.file!.name}|${m.file!.size}`),
    );
    const deduped = withinPerFileLimit.filter((f) => !existingKeys.has(`${f.name}|${f.size}`));
    if (deduped.length < withinPerFileLimit.length) {
      toast.warning(t("duplicateMediaSkipped"));
    }
    if (deduped.length === 0) return;

    const currentTotal = mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0);
    const addedTotal = deduped.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + addedTotal > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      toast.error(t("totalUploadTooLarge"));
      return;
    }

    const newItems: MediaItem[] = await Promise.all(
      withinPerFileLimit.map(async (f) => {
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

  // Client-side canvas resize for images. Reduces upload size and gives the
  // server less work. Returns null when no resize is needed (dimensions already
  // within limits, or non-image).
  // Skip canvas resize for formats that would lose data when converted to JPEG.
  const SKIP_CLIENT_RESIZE = ["image/png", "image/webp", "image/avif"];

  async function maybeResizeImage(
    file: File,
    width: number,
    height: number,
  ): Promise<{ file: File; width: number; height: number } | null> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
    if (Math.max(width, height) <= MAX_IMAGE_DIMENSION) return null;
    if (SKIP_CLIENT_RESIZE.includes(file.type)) return null;

    const img = await createImageBitmap(file);
    try {
      let newWidth: number, newHeight: number;
      if (width > height) {
        newWidth = MAX_IMAGE_DIMENSION;
        newHeight = Math.round((height / width) * MAX_IMAGE_DIMENSION);
      } else {
        newHeight = MAX_IMAGE_DIMENSION;
        newWidth = Math.round((width / height) * MAX_IMAGE_DIMENSION);
      }

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", IMAGE_JPEG_QUALITY / 100),
      );
      if (!blob) return null;
      return { file: new File([blob], file.name, { type: "image/jpeg" }), width: newWidth, height: newHeight };
    } finally {
      img.close();
    }
  }

  async function uploadNewFiles(postId: string): Promise<{ media: MediaInput[]; error: string | null }> {
    const toUpload = mediaItems.filter((m) => m.file);
    if (toUpload.length === 0) return { media: [], error: null };

    const files = toUpload.map((item) => ({
      item,
      fileName: item.file!.name,
      contentType: item.file!.type,
    }));

    const urlRes = await fetch("/api/upload-url/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, files: files.map((f) => ({ fileName: f.fileName, contentType: f.contentType, size: f.item.file!.size })) }),
    });

    if (!urlRes.ok) {
      const errBody = await urlRes.json().catch(() => ({}));
      if (errBody?.error === "too_many_requests") return { media: [], error: "rate_limited" };
      return { media: [], error: "upload_failed" };
    }

    const { urls } = await urlRes.json();

    const results = await Promise.allSettled(
      files.map(async ({ item }, i) => {
        const { uploadUrl, publicUrl, key } = urls[i];
        const file = item.file!;
        const resized = await maybeResizeImage(file, item.width ?? 0, item.height ?? 0);
        const uploadFile = resized?.file ?? file;

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: uploadFile,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error("upload_failed");

        let mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
        let width: number | undefined;
        let height: number | undefined;

        if (resized) {
          width = resized.width;
          height = resized.height;
        } else if (file.type.startsWith("image/") && file.type !== "image/gif") {
          try {
            const compressRes = await fetch("/api/compress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            });
            if (compressRes.ok) {
              const comp = await compressRes.json();
              mediaType = comp.mediaType;
              width = comp.width;
              height = comp.height;
            }
          } catch {
            // Compress failed — use raw dimensions if available
          }
        }

        if (width === undefined && item.width) width = item.width;
        if (height === undefined && item.height) height = item.height;

        return { url: publicUrl, type: mediaType, width, height } as MediaInput;
      }),
    );

    const uploaded: MediaInput[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        return { media: uploaded, error: "upload_failed" };
      }
      uploaded.push(result.value);
    }

    return { media: uploaded, error: null };
  }

  async function cleanupUploaded(uploaded: MediaInput[]) {
    if (uploaded.length === 0) return;
    const urls = uploaded.map((m) => m.url);
    fetch("/api/upload/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    }).catch(() => {});
  }

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
      const { media: uploaded, error: uploadError } = await uploadNewFiles(targetPostId);
      if (uploadError) {
        await cleanupUploaded(uploaded);
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
        await cleanupUploaded(uploaded);
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

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-gold"
            />
            <span className={isPublic ? "text-tulsi" : "text-saffron"}>
              {isPublic ? t("public") : t("private")}
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
