"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { isApiErrorCode } from "@/lib/api-error";
import { ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { parseDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/blog";
import { getImageDimensions } from "@/lib/client-media";
import { uploadMediaFiles, cleanupUploadedMedia } from "@/lib/client-upload";
import { useIdentity } from "@/components/IdentityProvider";
import { BLOG_TITLE_MAX_LENGTH, BLOG_EXCERPT_MAX_LENGTH, BLOG_CONTENT_MAX_LENGTH, MAX_IMAGE_SIZE_BYTES, maxUploadSizeForContentType } from "@/lib/validation";
import type { BlogPost } from "@/types/blog";

const BYTES_PER_MB = 1024 * 1024;

export interface BlogFormProps {
  mode: "create" | "edit";
  postId?: string;
  initialTitle?: string;
  initialExcerpt?: string | null;
  initialContent?: string | null;
  initialCoverUrl?: string | null;
  initialIsPublic?: boolean;
  initialPublishedAt?: string | null;
  onSuccess: (post: BlogPost) => void;
  onCancel?: () => void;
  postingChannel?: {
    id: string;
    name: string;
  };
}

export default function BlogForm({
  mode,
  postId,
  initialTitle = "",
  initialExcerpt = "",
  initialContent = "",
  initialCoverUrl = "",
  initialIsPublic = true,
  initialPublishedAt = "",
  onSuccess,
  onCancel,
  postingChannel,
}: BlogFormProps) {
  const { data: session } = useSession();
  const { activeChannelId } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const common = useTranslations("Common");

  const [title, setTitle] = useState(initialTitle);
  const [excerpt, setExcerpt] = useState(initialExcerpt ?? "");
  const [content, setContent] = useState(initialContent ?? "");
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [publishedAt, setPublishedAt] = useState(
    initialPublishedAt ? toDateTimeLocalValue(initialPublishedAt) : toDateTimeLocalValue(new Date()),
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isVerified = !!session?.user?.emailVerifiedAt;
  const canSubmit = title.trim().length > 0 && (content.trim().length > 0 || excerpt.trim().length > 0);
  const effectiveCover = coverFile ? coverPreview : (coverUrl || null);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidCoverType"));
      if (e.target) e.target.value = "";
      return;
    }
    if (file.size > maxUploadSizeForContentType(file.type)) {
      toast.error(t("coverTooLarge", { max: MAX_IMAGE_SIZE_BYTES / BYTES_PER_MB }));
      if (e.target) e.target.value = "";
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    if (e.target) e.target.value = "";
  }

  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      // Upload a newly picked cover first (browser→R2 direct, same flow as
      // post media). The server proves ownership via the PendingUpload claim.
      let resolvedCoverUrl = coverUrl.trim() || undefined;
      if (coverFile) {
        setUploading(true);
        try {
          const dims = await getImageDimensions(coverFile);
          const draftId = mode === "create" ? crypto.randomUUID() : postId!;
          const { media: uploaded, error: uploadError } = await uploadMediaFiles(
            draftId,
            [{ file: coverFile, width: dims?.width, height: dims?.height }],
            mode === "create" ? (postingChannel?.id ?? activeChannelId ?? undefined) : undefined,
          );
          if (uploadError || uploaded.length === 0) {
            await cleanupUploadedMedia(uploaded.map((m) => m.url));
            throw new Error(uploadError ?? "upload_failed");
          }
          resolvedCoverUrl = uploaded[0].url;
        } finally {
          setUploading(false);
        }
      }
      const parsedPublishedAt = parseDateTimeLocalValue(publishedAt);
      const body: Record<string, unknown> = {
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        content: content.trim() || undefined,
        // Explicit null clears the cover on edit; create omits it instead
        // (the create schema doesn't accept null).
        coverUrl: resolvedCoverUrl ?? (mode === "create" ? undefined : null),
        isPublic,
        language: locale,
        ...(parsedPublishedAt ? { publishedAt: parsedPublishedAt.toISOString() } : {}),
      };
      const url = mode === "create" ? "/api/blog-posts" : `/api/blog-posts/${postId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (isApiErrorCode(data, ERROR_TOO_MANY_REQUESTS)) {
          setError(common("tooManyRequests"));
        } else {
          setError(mode === "create" ? t("createFailed") : t("updateFailed"));
        }
        return;
      }
      const post = (await res.json()) as BlogPost;
      toast.success(mode === "create" ? t("published") : t("updated"));
      if (mode === "create") {
        setTitle("");
        setExcerpt("");
        setContent("");
        setCoverUrl("");
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverFile(null);
        setCoverPreview(null);
        setIsPublic(true);
        setPublishedAt(toDateTimeLocalValue(new Date()));
      }
      onSuccess(post);
    } catch (err) {
      if (err instanceof Error && err.message === "rate_limited") {
        setError(common("tooManyRequests"));
      } else if (err instanceof Error && err.message === "upload_failed") {
        setError(t("uploadFailed"));
      } else {
        setError(mode === "create" ? t("createFailed") : t("updateFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {postingChannel ? (
        <p className="text-sm text-deep/60">
          {t("postingAs")} <span className="font-semibold text-deep">{postingChannel.name}</span>
        </p>
      ) : null}
      {!isVerified ? (
        <p className="text-sm text-deep/60">{t("verifyToPost")}</p>
      ) : null}
      <Input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("titlePlaceholder")}
        maxLength={BLOG_TITLE_MAX_LENGTH}
        autoComplete="off"
      />
      <Textarea
        name="excerpt"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder={t("excerptPlaceholder")}
        maxLength={BLOG_EXCERPT_MAX_LENGTH}
        rows={2}
      />
      <Textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("contentPlaceholder")}
        maxLength={BLOG_CONTENT_MAX_LENGTH}
        rows={8}
      />
      <div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t("uploadCover")}
          onChange={handleCoverSelect}
        />
        {effectiveCover ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveCover}
              alt={title.trim() || t("titlePlaceholder")}
              className="h-40 w-full rounded-md object-cover"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                {t("changeCover")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={removeCover}>
                {t("removeCover")}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()}>
            {t("uploadCover")}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-deep/80">
          <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label={t("public")} />
          {isPublic ? t("public") : t("private")}
        </label>
        <label className="flex items-center gap-2 text-sm text-deep/80">
          <span>{t("publishDate")}</span>
          <Input
            type="datetime-local"
            name="publishedAt"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="w-auto"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!canSubmit || submitting || uploading || !isVerified}>
          {submitting || uploading ? t("saving") : mode === "create" ? t("publish") : t("save")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
