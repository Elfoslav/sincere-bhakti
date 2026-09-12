"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
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

  const handleSuccess = useCallback(
    (updatedPost: BlogPost) => {
      onSuccess(updatedPost);
      onOpenChange(false);
    },
    [onSuccess, onOpenChange],
  );

  if (!post) return null;

  const fetched = fetchedPost && fetchedPost.id === post.id ? fetchedPost : null;
  const displayPost = post.content != null ? post : (fetched ?? post);
  const ready = displayPost.content != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader text={t("editTitle")} />
        {ready ? (
          <BlogForm
            key={displayPost.id}
            mode="edit"
            postId={displayPost.id}
            initialTitle={displayPost.title}
            initialExcerpt={displayPost.excerpt}
            initialContent={displayPost.content}
            initialCoverUrl={displayPost.coverUrl}
            initialIsPublic={displayPost.isPublic}
            initialPublishedAt={displayPost.publishedAt}
            initialCategories={displayPost.categories.map((c) => c.name)}
            onSuccess={handleSuccess}
            onCancel={() => onOpenChange(false)}
          />
        ) : failedId === post.id ? (
          <p role="alert" className="text-sm text-red-600">{t("bodyLoadFailed")}</p>
        ) : (
          <div aria-busy="true" className="space-y-3 py-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-deep/10" />
            <div className="h-24 w-full animate-pulse rounded bg-deep/10" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
