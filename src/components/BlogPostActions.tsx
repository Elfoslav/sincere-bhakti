"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link as LinkIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getBlogUrl } from "@/lib/blog-url";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BlogPost } from "@/types/blog";

export function isBlogPostManager(
  post: BlogPost,
  currentUserId?: string,
  manageableChannelIds?: string[],
): boolean {
  return !!(currentUserId === post.channel.ownerId || manageableChannelIds?.includes(post.channel.id));
}

/**
 * Edit/delete/copy-link buttons for a blog article, with the delete
 * confirmation dialog. Renders nothing unless the viewer may manage the
 * article's channel and at least one action callback is provided. Shared by
 * the feed card and the detail header so the logic lives in one place.
 */
export default function BlogPostActions({
  post,
  currentUserId,
  manageableChannelIds,
  onDelete,
  onEdit,
}: {
  post: BlogPost;
  currentUserId?: string;
  manageableChannelIds?: string[];
  onDelete?: (id: string) => void;
  onEdit?: (postId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const commonT = useTranslations("Common");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canManage = isBlogPostManager(post, currentUserId, manageableChannelIds);

  const handleCopyLink = useCallback(() => {
    const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const url = `${window.location.origin}${localePrefix}${getBlogUrl(post.shortId, post.slug)}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }, [locale, post.shortId, post.slug, t]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/blog-posts/${post.id}`, { method: "DELETE" });
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

  if (!canManage || (!onEdit && !onDelete)) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {onEdit ? (
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label={t("editPost")}
            title={t("editPost")}
            onClick={() => onEdit(post.id)}
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
