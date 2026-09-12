"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { getBlogUrl } from "@/lib/blog-url";
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
  const displayDate = post.publishedAt ?? post.createdAt;
  const date = new Date(displayDate).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isScheduled = post.publishedAt ? new Date(post.publishedAt) > new Date() : false;

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
        <BlogPostActions
          post={post}
          currentUserId={currentUserId}
          manageableChannelIds={manageableChannelIds}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </div>
      <Link href={getBlogUrl(post.shortId, post.slug)} className="block hover:text-gold">
        <h3 className="text-xl font-bold text-deep">{post.title}</h3>
      </Link>
      <BlogExcerpt post={post} className="mt-1 text-deep/80" clampClassName="line-clamp-3" />
      <CategoryChips
        categories={post.categories}
        onSelect={(category) => router.push(`/blog/category/${category.slug}`)}
        className="mt-2"
      />
    </Card>
  );
}
