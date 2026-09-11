"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Link as LinkIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getBlogUrl } from "@/lib/blog-url";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BlogPost } from "@/types/blog";

export default function BlogCard({
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

  const displayDate = post.publishedAt ?? post.createdAt;
  const date = new Date(displayDate).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isScheduled = post.publishedAt ? new Date(post.publishedAt) > new Date() : false;
  const canManage = !!(currentUserId === post.channel.ownerId || manageableChannelIds?.includes(post.channel.id));

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

  return (
    <Card>
      {post.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverUrl}
          alt={post.title}
          className="mb-3 h-48 w-full rounded-md object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold text-lg shrink-0">
          {post.channel.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/channels/${post.channel.slug}`}
            className="font-semibold text-deep hover:text-gold"
          >
            {post.channel.name}
          </Link>
          <p className="text-xs text-deep/60">
            <Link href={getBlogUrl(post.shortId, post.slug)} className="hover:text-gold">
              {date}
            </Link>
            {!post.isPublic ? (
              <span className="ml-2 rounded bg-deep/10 px-1.5 py-0.5 text-[11px] font-medium text-deep/70">
                {t("private")}
              </span>
            ) : isScheduled ? (
              <span className="ml-2 rounded bg-gold-light/20 px-1.5 py-0.5 text-[11px] font-medium text-gold-dark">
                {t("scheduled")}
              </span>
            ) : null}
          </p>
        </div>
        {canManage && (onEdit || onDelete) ? (
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
        ) : null}
      </div>
      <Link href={getBlogUrl(post.shortId, post.slug)} className="block hover:text-gold">
        <h3 className="text-xl font-bold text-deep">{post.title}</h3>
      </Link>
      {post.excerpt ? (
        <p className="mt-1 text-deep/80">{post.excerpt}</p>
      ) : post.content ? (
        <p className="mt-1 line-clamp-3 text-deep/80">{post.content}</p>
      ) : null}
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
    </Card>
  );
}
