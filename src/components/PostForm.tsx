"use client";

import { useContentSavedToast } from "@/lib/hooks/useContentSavedToast";
import ContentPublishingContext from "@/components/ContentPublishingContext";
import ContentFormActions from "@/components/ContentFormActions";
import AttachmentPicker from "@/components/AttachmentPicker";
import { useObjectUrlCleanup } from "@/lib/hooks/useObjectUrlCleanup";
import { useComposerFormState } from "@/lib/hooks/useComposerFormState";
import type { ComposerFormState, PostingChannel, ComposerMediaItem as MediaItem } from "@/types/content-composer";

import { useState, useRef, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, X } from "lucide-react";
import ContentVisibilityControl from "@/components/ContentVisibilityControl";
import UploadSizeMeter from "@/components/UploadSizeMeter";
import { BYTES_PER_MB, formatBytes } from "@/lib/format";
import { genId } from "@/lib/id";
import { getImageDimensions } from "@/lib/client-media";
import { usePendingMediaUploads } from "@/lib/hooks/usePendingMediaUploads";
import { isApiErrorCode } from "@/lib/api-error";
import { ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { useIdentity } from "@/components/IdentityProvider";
import LinkPreview from "@/components/LinkPreview";
import CategoryPicker from "@/components/CategoryPicker";
import type { Post } from "@/types/post";
import type { MediaInput } from "@/lib/services/post";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_TOTAL_UPLOAD_SIZE_BYTES,
  maxUploadSizeForContentType,
  getAcceptString,
  isUrlOnlyContent,
} from "@/lib/validation";
import { getFirstUrl } from "@/lib/autolink";


export interface PostFormHandle {
  getValues: () => {
    content: string;
    isPublic: boolean;
    mediaPreviews: { url: string; type: string; width: number | null; height: number | null }[];
    categories: string[];
  };
}

export interface PostFormProps extends ComposerFormState {
  mode: "create" | "edit";
  formId?: string;
  initialContent?: string;
  initialIsPublic?: boolean;
  initialMedia?: { url: string; type: string; width?: number | null; height?: number | null }[];
  initialCategories?: string[];
  postId?: string;
  onSuccess: (post: Post) => void;
  onCancel?: () => void;
  postingChannel?: PostingChannel;
}

const PostForm = forwardRef<PostFormHandle, PostFormProps>(function PostForm({
  mode,
  formId,
  initialContent = "",
  initialIsPublic = true,
  initialMedia,
  initialCategories = [],
  postId,
  onSuccess,
  onCancel,
  onSubmittingChange,
  onDirtyChange,
  postingChannel,
}, ref) {
  const { data: session } = useSession();
  const pendingUploads = usePendingMediaUploads();
  const showSaved = useContentSavedToast("post");
  const [createId, setCreateId] = useState(() => crypto.randomUUID());
  const { activeChannelId } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("PostsPage");
  const common = useTranslations("Common");
  const isVerified = !!session?.user?.emailVerifiedAt;
  const [content, setContent] = useState(initialContent);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [categories, setCategories] = useState<string[]>(initialCategories);
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
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useObjectUrlCleanup(mediaItems.map(item => item.previewUrl));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItemId = useRef<string | null>(null);
  const postingChannelId = postingChannel?.id ?? activeChannelId;
  useComposerFormState({ snapshot: JSON.stringify({ content, isPublic, categories, media: mediaItems.map((item) => item.id) }), busy: submitting || preparing, onDirtyChange, onSubmittingChange });


  const totalUploadSize = useMemo(
    () => mediaItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0),
    [mediaItems],
  );

  // For URL-only posts, capture the link's page title to derive a meaningful
  // slug (e.g. YouTube title) instead of `https-www-youtube-...`. Debounced
  // so typing doesn't hammer the preview endpoint. Mirrors LinkPreview's
  // 400ms debounce and rate-limit friendly behaviour.
  const [linkPreviewTitle, setLinkPreviewTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!isUrlOnlyContent(content)) {
      setLinkPreviewTitle(null);
      return;
    }
    const url = getFirstUrl(content);
    if (!url) {
      setLinkPreviewTitle(null);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const title = data?.preview?.title as string | undefined;
          setLinkPreviewTitle(title?.trim() || null);
        })
        .catch(() => setLinkPreviewTitle(null));
    }, 400);
    return () => clearTimeout(id);
  }, [content]);

  useImperativeHandle(ref, () => ({
    getValues: () => ({
      content,
      isPublic,
      categories,
      mediaPreviews: mediaItems.map((m) => ({
        url: m.file ? m.previewUrl! : m.url!,
        type: m.type,
        width: m.width ?? null,
        height: m.height ?? null,
      })),
    }),
  }), [content, isPublic, categories, mediaItems]);

  async function handleFiles(selected: File[]) {
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
          type: f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || submitting || preparing) return;
    const trimmed = content.trim();
    if (!trimmed && mediaItems.length === 0) {
      toast.error(t("nothingToPost"));
      return;
    }

    setSubmitting(true);

    const targetPostId = mode === "create" ? createId : postId!;

    try {
      const { media: uploaded, error: uploadError } = await pendingUploads.upload(
        targetPostId,
        mediaItems.filter((m) => m.file).map((m) => ({ file: m.file!, width: m.width, height: m.height })),
        mode === "create" ? postingChannelId ?? undefined : undefined,
      );
      if (uploadError) {
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

      const url = mode === "edit" && postId ? `/api/posts/${postId}` : "/api/posts";
      const method = mode === "edit" ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        id: mode === "create" ? targetPostId : undefined,
        content: mode === "edit" ? (trimmed || null) : (trimmed || undefined),
        isPublic,
        language: mode === "create" ? locale : undefined,
        channelId: mode === "create" ? postingChannelId ?? undefined : undefined,
        media: mode === "edit" ? media : (media.length > 0 ? media : undefined),
        // Edit always sends the set (possibly empty = cleared); create omits
        // it when untouched so the schema default applies.
        categories: mode === "edit" ? categories : (categories.length > 0 ? categories : undefined),
        // Slug hint for URL-only posts: a human title instead of `https-...`.
        linkTitle: isUrlOnlyContent(trimmed) && linkPreviewTitle ? linkPreviewTitle : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const post: Post = await res.json();
        pendingUploads.commit(uploaded.map(item => item.url));
        setCreateId(crypto.randomUUID());
        setContent("");
        setCategories([]);
        setMediaItems((prev) => {
          prev.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
          return [];
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        showSaved(post, mode);
        onSuccess(post);
      } else {
        const body = await res.json().catch(() => ({}));
        const err = body?.error ?? "";
        if (err === "validation_error:input:custom") {
          toast.error(t("nothingToPost"));
        } else if (res.status === 429 || isApiErrorCode(body, ERROR_TOO_MANY_REQUESTS)) {
          toast.error(common("tooManyRequests"));
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

  return (
    <form onSubmit={handleSubmit} id={formId}>
      <fieldset disabled={submitting || preparing || (mode === "create" && !isVerified)} className="min-w-0">
      {mode === "create" && <ContentPublishingContext channel={postingChannel} />}

      <>
          <Textarea
            aria-label={t("composePlaceholder")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={mode === "edit" ? undefined : t("composePlaceholder")}
            size="compose"
            autoResize
          />

          <div className="mt-3">
            <LinkPreview text={content} />
          </div>

          <div className="mt-3">
            <label htmlFor={`${formId ?? "post"}-categories`} className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("categoriesLabel")}
            </label>
            <CategoryPicker
              id={`${formId ?? "post"}-categories`}
              value={categories}
              onChange={setCategories}
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
                        // Using <img> for inline media preview thumbnails (64x48px): client-side
                        // blob URLs or editing mode R2 URLs, fixed tiny size, no optimization needed.
                        <img src={item.file ? item.previewUrl! : item.url!} alt="" className="w-full h-full object-cover" />
                      )
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 hidden md:block">
                    {item.file ? item.file.name : item.url?.split("/").pop()}
                  </span>
                  {item.file && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {formatBytes(item.file.size)}
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={() => removeMedia(item.id)}
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

          <AttachmentPicker label={t("attachMedia")} inputRef={fileInputRef} accept={getAcceptString()} multiple disabled={submitting} onFiles={handleFiles} onPreparingChange={setPreparing} />
          <UploadSizeMeter used={totalUploadSize} max={MAX_TOTAL_UPLOAD_SIZE_BYTES} />
          <ContentVisibilityControl isPublic={isPublic} onChange={setIsPublic} />
          <ContentFormActions mode={mode} isPublic={isPublic} busy={submitting || preparing} onCancel={onCancel}
            disabled={submitting || preparing || (mode === "create" && !postingChannelId) || (!content.trim() && mediaItems.length === 0)} />
      </>
      </fieldset>
    </form>
  );
});

export default PostForm;
