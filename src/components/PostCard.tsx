"use client";

import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localeFlags } from "@/i18n/routing";
import { Link as LinkIcon, ExternalLink, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { extractYouTubeContent } from "@/lib/video";
import { replaceEmoticons } from "@/lib/emoticons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ImageGallery from "@/components/ImageGallery";
import type { Post } from "@/types/post";

export default function PostCard({
  post,
  currentUserId,
  hideEdit,
  hideExternalLink,
  manageableChannelIds,
  onDelete,
  onEdit,
}: {
  post: Post;
  currentUserId?: string;
  hideEdit?: boolean;
  hideExternalLink?: boolean;
  manageableChannelIds?: string[];
  onDelete?: (id: string) => void;
  onEdit?: (postId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("PostCard");
  const commonT = useTranslations("Common");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
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
  const canManage = !!(currentUserId === post.channel.ownerId || manageableChannelIds?.includes(post.channel.id));

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${locale}/posts/${post.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }, [locale, post.id, t]);

  useEffect(() => {
    if (!showMobileActions) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMobileActions]);

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
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold text-lg shrink-0">
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
            <span className="mr-1 text-sm text-deep" title={post.language}>
              {localeFlags[post.language] || post.language}
            </span>
            <Link href={`/posts/${post.id}`} className="hover:text-gold">
              {date}
            </Link>
          </p>
        </div>
        <ActionsRow
          canManage={canManage}
          hideEdit={hideEdit}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={isDeleting}
          handleCopyLink={handleCopyLink}
          hideExternalLink={hideExternalLink}
          postId={post.id}
          editPostLabel={t("editPost")}
          deleteLabel={t("delete")}
          copyLinkLabel={t("copyLink")}
          openPostLabel={t("openPost")}
          setShowDeleteConfirm={setShowDeleteConfirm}
          showMobileActions={showMobileActions}
          setShowMobileActions={setShowMobileActions}
          mobileMenuRef={mobileMenuRef}
        />
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
            /* preload="none": without it every video in the feed fetches
               metadata/initial segments on page load. */
            <video
              src={m.url}
              controls
              preload="none"
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

      {canManage && (
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
    </Card>
  );
}

function ActionsRow({
  canManage,
  hideEdit,
  onEdit,
  onDelete,
  isDeleting,
  handleCopyLink,
  hideExternalLink,
  postId,
  editPostLabel,
  deleteLabel,
  copyLinkLabel,
  openPostLabel,
  setShowDeleteConfirm,
  showMobileActions,
  setShowMobileActions,
  mobileMenuRef,
}: {
  canManage: boolean;
  hideEdit?: boolean;
  onEdit?: (postId: string) => void;
  onDelete?: (id: string) => void;
  isDeleting: boolean;
  handleCopyLink: () => void;
  hideExternalLink?: boolean;
  postId: string;
  editPostLabel: string;
  deleteLabel: string;
  copyLinkLabel: string;
  openPostLabel: string;
  setShowDeleteConfirm: (v: boolean) => void;
  showMobileActions: boolean;
  setShowMobileActions: (v: boolean) => void;
  mobileMenuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("PostCard");
  interface ActionDef {
    key: string;
    icon: React.ReactNode;
    label: string;
    dropdownLabel: string;
    isDestructive?: boolean;
    onAction?: () => void;
    href?: string;
  }

  const allActions: ActionDef[] = [];
  if (canManage && !hideEdit && onEdit) {
    allActions.push({ key: "edit", icon: <Pencil />, label: editPostLabel, dropdownLabel: t("dropdownEdit"), onAction: () => onEdit(postId) });
  }
  if (canManage && onDelete) {
    allActions.push({ key: "delete", icon: <Trash2 />, label: deleteLabel, dropdownLabel: t("dropdownDelete"), isDestructive: true, onAction: () => setShowDeleteConfirm(true) });
  }
  allActions.push({ key: "copy", icon: <LinkIcon />, label: copyLinkLabel, dropdownLabel: t("dropdownCopyLink"), onAction: handleCopyLink });
  if (!hideExternalLink) {
    allActions.push({ key: "open", icon: <ExternalLink />, label: openPostLabel, dropdownLabel: t("dropdownOpen"), href: `/posts/${postId}` });
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <div className="hidden md:flex items-center gap-1">
        {allActions.map((a) => (
          <Button
            key={a.key}
            onClick={a.onAction}
            href={a.href}
            disabled={a.key === "delete" ? isDeleting : undefined}
            variant={a.isDestructive ? "icon-destructive" : undefined}
            title={a.label}
            aria-label={a.label}
            icon={a.icon}
          />
        ))}
      </div>

      <div className="flex md:hidden items-center gap-1">
        {allActions.length <= 2 ? allActions.map((a) => (
          <Button
            key={a.key}
            onClick={a.onAction}
            href={a.href}
            disabled={a.key === "delete" ? isDeleting : undefined}
            variant={a.isDestructive ? "icon-destructive" : undefined}
            title={a.label}
            aria-label={a.label}
            icon={a.icon}
          />
        )) : (
          <div className="relative" ref={mobileMenuRef}>
            <Button
              onClick={() => setShowMobileActions(!showMobileActions)}
              icon={<MoreHorizontal />}
            />
            {showMobileActions && (
              <div className="absolute right-0 top-full mt-1 z-50 w-max min-w-28 rounded-lg border border-sand bg-white py-1 shadow-lg">
                {allActions.map((a) => {
                  const itemClassName = "flex w-full items-center gap-2.5 whitespace-nowrap border-b border-sand/50 px-3 py-1.5 text-sm text-deep last:border-b-0 hover:bg-sand/40";
                  const itemContent = (
                    <>
                      <span className="size-4 shrink-0 text-deep/40 [&>svg]:size-4">{a.icon}</span>
                      {a.dropdownLabel}
                    </>
                  );
                  return a.href ? (
                    <Link
                      key={a.key}
                      href={a.href}
                      onClick={() => setShowMobileActions(false)}
                      className={itemClassName}
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <button
                      key={a.key}
                      onClick={() => { setShowMobileActions(false); a.onAction?.(); }}
                      className={itemClassName}
                    >
                      {itemContent}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
