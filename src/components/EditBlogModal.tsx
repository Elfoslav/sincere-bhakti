"use client";

import { useCallback } from "react";
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

  const handleSuccess = useCallback(
    (updatedPost: BlogPost) => {
      onSuccess(updatedPost);
      onOpenChange(false);
    },
    [onSuccess, onOpenChange],
  );

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader text={t("editTitle")} />
        <BlogForm
          key={post.id}
          mode="edit"
          postId={post.id}
          initialTitle={post.title}
          initialExcerpt={post.excerpt}
          initialContent={post.content}
          initialCoverUrl={post.coverUrl}
          initialIsPublic={post.isPublic}
          initialPublishedAt={post.publishedAt}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
