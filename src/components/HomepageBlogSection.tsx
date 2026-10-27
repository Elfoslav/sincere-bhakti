"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import FeedEmptyState from "@/components/FeedEmptyState";
import BlogCard from "@/components/BlogCard";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";
import { LATEST_BLOG_POSTS_LIMIT } from "@/lib/blog";

export default function HomepageBlogSection() {
  const locale = useLocale();
  const t = useTranslations("HomePage");
  const { posts, loading, error, retry } = useInfiniteBlogPosts({
    scope: "public",
    language: locale,
    pageSize: LATEST_BLOG_POSTS_LIMIT,
  });

  // Don't flash empty state while loading; keep homepage clean
  if (loading) return null;
  if (error) return <section className="section-space"><FeedEmptyState error onRetry={retry} /></section>;
  if (posts.length === 0) return null;

  const visible = posts.slice(0, LATEST_BLOG_POSTS_LIMIT);

  return (
    <section className="section-space text-left" aria-labelledby="home-blog-heading">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 id="home-blog-heading" className="type-section">
          {t("blogLatestTitle")}
        </h2>
        <Link
          href="/blog"
          className="shrink-0 text-sm font-medium text-saffron hover:text-saffron-dark transition-colors"
        >
          {t("viewAllBlog")} <ArrowRight className="ml-1 inline size-4" aria-hidden />
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{t("blogLatestSubtitle")}</p>
      <div className="article-feed-list">
        {visible.map((post, index) => (
          <BlogCard key={post.id} post={post} variant="list" featured={index === 0} />
        ))}
      </div>
    </section>
  );
}
