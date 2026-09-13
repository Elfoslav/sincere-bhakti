"use client";

import { useMemo } from "react";
import { previewRichText } from "@/lib/rich-text";
import { stripExcerptLinks } from "@/lib/excerpt";
import { cn } from "@/lib/utils";
import type { BlogPost } from "@/types/blog";

/**
 * Article excerpt for feed cards: the hand-written summary when set,
 * otherwise the sanitized article HTML (clamped), otherwise a plain-text
 * preview covering legacy bodies without rendered HTML. contentHtml arrives
 * server-sanitized (toBlogPostResponse re-sanitizes on read) — never feed
 * raw stored HTML here.
 */
export default function BlogExcerpt({
  post,
  className,
  clampClassName,
}: {
  post: Pick<BlogPost, "excerpt" | "content" | "contentHtml">;
  className?: string;
  clampClassName?: string;
}) {
  const html = useMemo(
    () => (post.contentHtml?.trim() ? stripExcerptLinks(post.contentHtml) : null),
    [post.contentHtml],
  );
  const fallback = useMemo(() => previewRichText(post.content), [post.content]);

  if (post.excerpt) {
    return <p className={cn(className, clampClassName)}>{post.excerpt}</p>;
  }
  if (html) {
    return (
      <div
        className={cn("rich-text rich-text-excerpt", className, clampClassName)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (fallback) {
    return <p className={cn(className, clampClassName)}>{fallback}</p>;
  }
  return null;
}
