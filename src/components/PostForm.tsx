"use client";

import { useState, useRef, useCallback } from "react";
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
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const files = selected.filter(
      (f) => f.size <= maxUploadSizeForContentType(f.type),
    );
    if (files.length < selected.length) {
      toast.error(
        t("fileTooLarge", {
          imageMax: MAX_IMAGE_SIZE_BYTES / BYTES_PER_MB,
          videoMax: MAX_VIDEO_SIZE_BYTES / BYTES_PER_MB,
        }),
      );
    }
    if (files.length === 0) return;

    const newItems: MediaItem[] = await Promise.all(
      files.map(async (f) => {
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

  async function uploadNewFiles(): Promise<MediaInput[]> {
    const toUpload = mediaItems.filter((m) => m.file);
    if (toUpload.length === 0) return [];

    const uploads = toUpload.map(async (item) => {
      const file = item.file!;
      let res: Response;
      try {
        res = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        });
      } catch {
        return null;
      }
      if (!res.ok) return null;
      const { uploadUrl, publicUrl, mediaType: mt } = await res.json();
      let putRes: Response;
      try {
        putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
      } catch {
        return null;
      }
      if (!putRes.ok) return null;
      return { url: publicUrl, type: mt, width: item.width, height: item.height };
    });

    const results = await Promise.allSettled(uploads);
    const uploaded: MediaInput[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        uploaded.push(r.value);
      } else {
        throw new Error("upload_failed");
      }
    }
    return uploaded;
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

    try {
      const uploaded = await uploadNewFiles();
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
        content: postContent || undefined,
        isPublic,
        language: mode === "create" ? locale : undefined,
        media: media.length > 0 ? media : undefined,
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
        toast.error(mode === "edit" ? t("updatePostFailed") : t("createPostFailed"));
      }
    } catch (err) {
      if (err instanceof Error && err.message === "upload_failed") {
        toast.error(t("uploadFailed"));
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
