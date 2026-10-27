"use client";

import { useMemo } from "react";
import { BLOG_EXCERPT_MAX_LENGTH } from "@/lib/validation";
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
  plain = false,
}: {
  post: Pick<BlogPost, "excerpt" | "content" | "contentHtml">;
  className?: string;
  clampClassName?: string;
  plain?: boolean;
}) {
  const html = useMemo(
    () => (post.contentHtml?.trim() ? stripExcerptLinks(post.contentHtml) : null),
    [post.contentHtml],
  );
  const fallback = useMemo(() => previewRichText(post.content, plain ? BLOG_EXCERPT_MAX_LENGTH : undefined), [post.content, plain]);

  if (post.excerpt) {
    return <p className={cn(className, clampClassName)}>{post.excerpt}</p>;
  }
  if (plain && fallback) return <p className={cn(className, clampClassName)}>{fallback}</p>;
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
