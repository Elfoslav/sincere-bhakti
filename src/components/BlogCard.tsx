"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { getBlogUrl } from "@/lib/blog-url";
import { formatBlogDate } from "@/lib/blog";
import { Card } from "@/components/ui/card";
import BlogExcerpt from "@/components/BlogExcerpt";
import CategoryChips from "@/components/CategoryChips";
import BlogPostActions from "@/components/BlogPostActions";
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
  const router = useRouter();
  const t = useTranslations("BlogPage");
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale);
  const isScheduled = post.publishedAt ? new Date(post.publishedAt) > new Date() : false;

  return (
    <Card>
      {/* Title row — actions sit tight to the title on the right so they are
          always discoverable but don't compete with the cover. When there is
          a cover, the thumb lives in the body row below — no overlap. */}
      <div className="flex items-start justify-between gap-3">
        <Link href={getBlogUrl(post.shortId, post.slug)} className="min-w-0 flex-1 text-deep hover:text-gold transition-colors">
          <h3 className="font-heading text-xl font-bold leading-tight line-clamp-2 sm:text-[22px]">
            {post.title}
          </h3>
        </Link>
        <div className="shrink-0 -mr-1 -mt-1">
          <BlogPostActions
            post={post}
            currentUserId={currentUserId}
            manageableChannelIds={manageableChannelIds}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </div>
      </div>

      {/* Body row — excerpt + byline on left, cover thumb on right.
          Thumb is below the title-actions row, so actions and image never
          fight for the same corner. */}
      <div className="mt-2 flex gap-4 items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div
              className="shrink-0 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold"
              style={{ width: 22, height: 22, fontSize: 10 }}
              aria-hidden
            >
              {post.channel.name?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-0.5 flex-wrap text-xs text-deep/60">
              <Link
                href={`/channels/${post.channel.slug}`}
                className="min-w-0 max-w-full truncate font-medium text-deep/70 hover:text-gold transition-colors"
              >
                {post.channel.name}
              </Link>
              <span className="shrink-0 text-deep/30" aria-hidden>
                ·
              </span>
              <span className="shrink-0 whitespace-nowrap">{date}</span>
            </span>
            {!post.isPublic ? (
              <span className="shrink-0 rounded-full bg-deep/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-deep/70">
                {t("private")}
              </span>
            ) : isScheduled ? (
              <span className="shrink-0 rounded-full bg-gold-light/25 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-gold-dark">
                {t("scheduled")}
              </span>
            ) : null}
          </div>

          <BlogExcerpt
            post={post}
            className="mt-2 text-sm leading-relaxed text-deep/60"
            clampClassName="line-clamp-2"
          />

          <CategoryChips
            categories={post.categories}
            onSelect={(category) => router.push(`/blog/category/${category.slug}`)}
            className="mt-2"
          />
        </div>

        {post.coverUrl ? (
          <Link
            href={getBlogUrl(post.shortId, post.slug)}
            className="block shrink-0 overflow-hidden rounded-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverUrl}
              alt=""
              className="h-20 w-20 object-cover sm:h-28 sm:w-28"
              loading="lazy"
            />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
