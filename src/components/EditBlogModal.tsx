"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ContentComposer from "@/components/ContentComposer";
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
  // `exit` mirrors BlogForm: parents refresh lists on every save but dismiss
  // the modal (null the editing post) only on leave — otherwise Save & stay
  // would close through the parent even though the modal stays open.
  onSuccess: (post: BlogPost, exit: boolean) => void;
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

  if (!post) return null;

  const fetched = fetchedPost && fetchedPost.id === post.id ? fetchedPost : null;
  const displayPost = post.content != null ? post : (fetched ?? post);
  const ready = displayPost.content != null;

  return (
    <ContentComposer open={open} onOpenChange={onOpenChange} title={t("editTitle")} wide>
      {({ complete, requestClose, formState }) => ready ? (
        <BlogForm key={displayPost.id} mode="edit" postId={displayPost.id}
          initialTitle={displayPost.title} initialSlug={displayPost.slug} initialExcerpt={displayPost.excerpt}
          initialContent={displayPost.content} initialCoverUrl={displayPost.coverUrl} initialIsPublic={displayPost.isPublic}
          initialPublishedAt={displayPost.publishedAt} initialCategories={displayPost.categories.map((c) => c.name)}
          {...formState} onCancel={requestClose} onSuccess={(updated, exit) => { onSuccess(updated, exit); if (exit) complete(); }} />
      ) : failedId === post.id ? (
        <p role="alert" className="text-sm text-destructive">{t("bodyLoadFailed")}</p>
      ) : (
        <div aria-busy="true" className="space-y-3 py-4"><div className="h-8 w-2/3 animate-pulse rounded bg-deep/10" /><div className="h-24 w-full animate-pulse rounded bg-deep/10" /></div>
      )}
    </ContentComposer>
  );
}
