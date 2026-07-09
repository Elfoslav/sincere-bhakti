"use client";

import { useMemo, useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractYouTubeContent } from "@/lib/video";
import { replaceEmoticons } from "@/lib/emoticons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ImageGallery from "@/components/ImageGallery";
import type { Post } from "@/types/post";

export default function PostCard({
  post,
  currentUserId,
  hideEdit,
  hideExternalLink,
  onDelete,
}: {
  post: Post;
  currentUserId?: string;
  hideEdit?: boolean;
  hideExternalLink?: boolean;
  onDelete?: (id: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("PostCard");
  const commonT = useTranslations("Common");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const date = new Date(post.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { cleanContent, displayContent } = useMemo(() => {
    const { cleanContent } = extractYouTubeContent(post.content);
    return { cleanContent, displayContent: replaceEmoticons(cleanContent) };
  }, [post.content]);

  const images = useMemo(() => post.media.filter((m) => m.type === "image"), [post.media]);
  const otherMedia = useMemo(() => post.media.filter((m) => m.type !== "image"), [post.media]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${locale}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }, [locale, post.id, t]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("deleteFailed"));
        setShowDeleteConfirm(false);
        return;
      }
      toast.success(t("deleteSuccess"));
      setShowDeleteConfirm(false);
      onDelete?.(post.id);
    } catch {
      toast.error(t("deleteFailed"));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [post.id, t, onDelete]);

  return (
    <div className="bg-white rounded-lg shadow-md p-5 border border-sand">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-deep font-bold text-lg shrink-0">
          {post.channel.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/channels/${post.channel.slug}`}
            className="font-semibold text-deep hover:text-gold"
          >
            {post.channel.name || t("anonymous")}
          </Link>
          <p className="text-xs text-deep/60">
            <Link href={`/post/${post.id}`} className="hover:text-gold">
              {date}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {currentUserId === post.channel.ownerId && !hideEdit && (
            <Link
              href={`/post/${post.id}/edit`}
              className="text-deep/40 hover:text-gold transition-colors p-1"
              title={t("editPost")}
              aria-label={t("editPost")}
            >
              <Pencil className="w-4 h-4" />
            </Link>
          )}
          {currentUserId === post.channel.ownerId && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-deep/40 hover:text-red-500 transition-colors p-1 cursor-pointer disabled:opacity-30"
              title={t("delete")}
              aria-label={t("delete")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {hideExternalLink ? (
            <button
              onClick={handleCopyLink}
              className="text-deep/40 hover:text-gold transition-colors p-1 cursor-pointer"
              title={t("copyLink")}
              aria-label={t("copyLink")}
            >
              <Copy className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href={`/post/${post.id}`}
              className="text-deep/40 hover:text-gold transition-colors p-1"
              title={t("openPost")}
              aria-label={t("openPost")}
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {cleanContent && (
        <p className="text-deep mb-3 whitespace-pre-wrap">{displayContent}</p>
      )}

      <ImageGallery images={images} t={t} />

      {otherMedia.map((m) => (
        <div key={m.url} className="rounded-lg overflow-hidden mb-2">
          {m.type === "youtube" ? (
            <div className="aspect-video">
              <iframe
                src={m.url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title={t("youtubeVideo")}
              />
            </div>
          ) : m.type === "video" ? (
            <video
              src={m.url}
              controls
              className="w-full max-h-96 object-contain"
            />
          ) : (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-warm/50 rounded-md border border-sand text-deep hover:bg-warm transition-colors"
            >
              <span className="text-sm">📎</span>
              <span className="text-sm font-medium truncate">{m.url.split("/").pop()}</span>
            </a>
          )}
        </div>
      ))}

      {currentUserId === post.channel.ownerId && (
        <div className="flex items-center gap-2 text-xs text-deep/50">
          {post.isPublic ? (
            <span className="bg-tulsi/20 text-tulsi px-2 py-0.5 rounded-full">
              {t("public")}
            </span>
          ) : (
            <span className="bg-saffron/20 text-saffron-dark px-2 py-0.5 rounded-full">
              {t("private")}
            </span>
          )}
        </div>
      )}

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
    </div>
  );
}
