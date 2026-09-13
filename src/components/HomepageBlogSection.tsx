"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BlogCard from "@/components/BlogCard";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";

export default function HomepageBlogSection() {
  const locale = useLocale();
  const t = useTranslations("HomePage");
  const { posts, loading } = useInfiniteBlogPosts({
    scope: "public",
    language: locale,
    pageSize: 3,
  });

  // Don't flash empty state while loading; keep homepage clean
  if (loading) return null;
  if (posts.length === 0) return null;

  const visible = posts.slice(0, 3);

  return (
    <section className="mt-16 text-left" aria-labelledby="home-blog-heading">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 id="home-blog-heading" className="font-heading text-2xl font-bold text-deep">
          {t("blogLatestTitle")}
        </h2>
        <Link
          href="/blog"
          className="shrink-0 text-sm font-medium text-saffron hover:text-saffron-dark transition-colors"
        >
          {t("viewAllBlog")} →
        </Link>
      </div>
      <p className="text-sm text-deep/60 mb-6">{t("blogLatestSubtitle")}</p>
      <div className="space-y-4">
        {visible.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
