"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { getBlogUrl } from "@/lib/blog-url";
import { estimateReadingMinutes, formatBlogDate } from "@/lib/blog";
import { getSettledMediaStatus } from "@/components/ui/loadable-media";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import BlogExcerpt from "@/components/BlogExcerpt";
import CategoryChips from "@/components/CategoryChips";
import BlogPostActions from "@/components/BlogPostActions";
import type { BlogPost } from "@/types/blog";

export default function BlogCard({ post, currentUserId, manageableChannelIds, onDelete, onEdit, variant = "default", featured = false }: {
  post: BlogPost;
  variant?: "default" | "editorial" | "list";
  featured?: boolean;
  currentUserId?: string;
  manageableChannelIds?: string[];
  onDelete?: (id: string) => void;
  onEdit?: (postId: string) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("BlogPage");
  const list = variant === "list";
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale, true);
  const isScheduled = post.publishedAt ? new Date(post.publishedAt) > new Date() : false;
  const readingMinutes = estimateReadingMinutes(post.contentHtml);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const cover = post.coverUrl && post.coverUrl !== failedCover ? post.coverUrl : null;
  const Title = list ? "h2" : "h3";

  return (
    <Card data-has-cover={Boolean(cover)} variant={variant === "default" ? "default" : "editorial"} className={cn(list ? "article-row" : variant === "editorial" ? "flex h-full flex-col pb-6" : undefined)}>
      {cover && (
        <Link href={getBlogUrl(post.shortId, post.slug)} aria-label={post.title} className={list ? "article-row-media media-zoom" : "media-zoom mb-5 block overflow-hidden rounded-lg"}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-provided covers may be hosted outside the image optimizer allowlist */}
          <img src={cover} alt="" loading="lazy" className={list ? "" : "aspect-[8/5] w-full object-cover"}
            onError={() => setFailedCover(cover)}
            ref={(image) => { if (image && getSettledMediaStatus(image) === "error") setFailedCover(cover); }} />
        </Link>
      )}
      <div className={list ? "article-row-copy" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <Link href={getBlogUrl(post.shortId, post.slug)} className="min-w-0 flex-1 text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
            <Title className={list ? "article-row-title line-clamp-2" : featured ? "font-heading text-3xl leading-tight line-clamp-3 sm:text-4xl" : "font-heading text-xl leading-tight line-clamp-2 sm:text-2xl"}>{post.title}</Title>
          </Link>
          <BlogPostActions post={post} currentUserId={currentUserId} manageableChannelIds={manageableChannelIds} onDelete={onDelete} onEdit={onEdit} />
        </div>
        <BlogExcerpt post={post} plain={list} className={list ? "article-row-excerpt" : "mt-3 text-sm leading-relaxed text-muted-foreground"} clampClassName={list ? "line-clamp-3" : "line-clamp-2"} />
        <div className={list ? "article-row-byline" : "mt-3 flex flex-col gap-1"}>
          <Link href={`/blog/channel/${post.channel.slug}`} className={cn("truncate hover:text-primary", list ? "article-row-author" : "text-sm text-muted-foreground")}>
            {t("byAuthor", { author: post.channel.name })}
          </Link>
          <div className={list ? "article-row-meta" : "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"}>
            <time dateTime={post.publishedAt ?? post.createdAt}>{date}</time>
            {readingMinutes > 0 && <><span aria-hidden="true">·</span><span>{t("readingTime", { minutes: readingMinutes })}</span></>}
            {(!post.isPublic || isScheduled) && <span className="article-status rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">{t(!post.isPublic ? "private" : "scheduled")}</span>}
          </div>
        </div>
        {!list && <CategoryChips categories={post.categories} onSelect={(category) => router.push(`/blog/category/${category.slug}`)} className="mt-2" />}
      </div>
    </Card>
  );
}
