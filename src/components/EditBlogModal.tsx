"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import BlogForm from "@/components/BlogForm";
import type { BlogPost } from "@/types/blog";

export default function EditBlogModal({
  post,
  open,
  onOpenChange,
  onSuccess,
}: {
  post: BlogPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (post: BlogPost) => void;
}) {
  const t = useTranslations("BlogPage");
  const [fetchedPost, setFetchedPost] = useState<BlogPost | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  // Unsaved-changes guard: dismissing with edits shows a confirm first.
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // List responses project article bodies away (perf): when the edit target
  // arrives without its JSON body, fetch the full article so the editor
  // initializes with real content instead of an empty document (typing into
  // an empty editor and saving would wipe the stored body). Only async
  // continuations below touch state (no synchronous setState in effect).
  useEffect(() => {
    if (!post || post.content != null) return;
    if (fetchedPost?.id === post.id && fetchedPost.content != null) return;
    let cancelled = false;
    fetch(`/api/blog-posts/${post.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BlogPost | null) => {
        if (cancelled) return;
        if (data && data.content != null) setFetchedPost(data);
        else setFailedId(post.id);
      })
      .catch(() => {
        if (!cancelled) setFailedId(post.id);
      });
    return () => {
      cancelled = true;
    };
  }, [post, fetchedPost]);

  // Save & stay keeps the modal open for continued editing (the parent
  // still receives the update); Save & leave and public Save close it.
  // A fresh save clears the guard: staying on is never "unsaved".
  const handleSuccess = useCallback(
    (updatedPost: BlogPost, exit: boolean) => {
      onSuccess(updatedPost);
      if (exit) {
        setShowLeaveConfirm(false);
        onOpenChange(false);
      }
    },
    [onSuccess, onOpenChange],
  );

  // Every dismissal path (close button, overlay, Escape, Cancel) funnels
  // here: dirty forms confirm first, clean ones close immediately.
  function handleOpenChange(next: boolean) {
    if (!next && isDirty) {
      setShowLeaveConfirm(true);
      return;
    }
    onOpenChange(next);
  }

  function handleLeaveConfirm() {
    setShowLeaveConfirm(false);
    onOpenChange(false);
  }

  if (!post) return null;

  const fetched = fetchedPost && fetchedPost.id === post.id ? fetchedPost : null;
  const displayPost = post.content != null ? post : (fetched ?? post);
  const ready = displayPost.content != null;

  // Rendered as a top-level sibling (not nested in the edit Dialog): a
  // nested confirm's backdrop is swallowed, leaving it floating over the
  // undimmed modal. As a sibling its overlay stacks above the edit modal.
  //
  // No top padding on the dialog: the editor toolbar is sticky and must sit
  // flush with the modal top (sticky respects container padding, so p-4 would
  // leave a content strip above the stuck bar). The header carries its own
  // top padding instead, so the resting layout is unchanged.
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto pt-0">
          <DialogHeader text={t("editTitle")} className="pt-4" />
          {ready ? (
            <BlogForm
              key={displayPost.id}
              mode="edit"
              postId={displayPost.id}
              initialTitle={displayPost.title}
              initialSlug={displayPost.slug}
              initialExcerpt={displayPost.excerpt}
              initialContent={displayPost.content}
              initialCoverUrl={displayPost.coverUrl}
              initialIsPublic={displayPost.isPublic}
              initialPublishedAt={displayPost.publishedAt}
              initialCategories={displayPost.categories.map((c) => c.name)}
              onSuccess={handleSuccess}
              onCancel={() => handleOpenChange(false)}
              onDirtyChange={setIsDirty}
            />
          ) : failedId === post.id ? (
            <p role="alert" className="pt-4 text-sm text-red-600">{t("bodyLoadFailed")}</p>
          ) : (
            <div aria-busy="true" className="space-y-3 py-4">
              <div className="h-8 w-2/3 animate-pulse rounded bg-deep/10" />
              <div className="h-24 w-full animate-pulse rounded bg-deep/10" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        title={t("unsavedTitle")}
        description={t("unsavedDescription")}
        confirmLabel={t("leaveWithoutSaving")}
        cancelLabel={t("keepEditing")}
        onConfirm={handleLeaveConfirm}
        variant="destructive"
      />
    </>
  );
}
