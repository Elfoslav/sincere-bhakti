"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CalendarDays, UserRound } from "lucide-react";
import BlogCard from "@/components/BlogCard";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatBlogDate, getLatestBlogPostsGridClass } from "@/lib/blog";
import type { BlogDetailVariantProps } from "@/types/blog-variants";

/**
 * Baseline: the design currently shipped on the detail page.
 */
export default function ClassicVariant({ post, contentHtml, latestPosts }: BlogDetailVariantProps) {
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[{ label: t("title"), href: "/blog" }, { label: post.title }]}
        className="mb-6"
        lastClassName="text-lg"
      />
      <div className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold text-lg shrink-0">
          {post.channel.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-deep">
            <UserRound className="size-4 shrink-0 text-deep/40" aria-hidden />
            <Link href={`/channels/${post.channel.slug}`} className="truncate hover:text-gold">
              {post.channel.name}
            </Link>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-deep/60">
            <CalendarDays className="size-4 shrink-0 text-deep/40" aria-hidden />
            {date}
          </p>
        </div>
      </div>
      <article>
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={post.title} className="mb-6 h-64 w-full rounded-lg object-cover" />
        ) : (
          <div
            aria-hidden
            className="mb-6 flex h-64 w-full items-center justify-center rounded-lg bg-gradient-to-br from-gold-light via-saffron to-saffron-dark text-7xl font-bold text-white/80"
          >
            {post.title?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <h1 className="text-3xl font-bold text-deep">{post.title}</h1>
        {post.excerpt ? <p className="mt-2 text-lg text-deep/70">{post.excerpt}</p> : null}
        {contentHtml ? (
          <div className="rich-text mt-6" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : null}
      </article>
      {latestPosts.length > 0 ? (
        <section aria-label={t("latestPosts")} className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-deep">{t("latestPosts")}</h2>
          <div className={getLatestBlogPostsGridClass(latestPosts.length)}>
            {latestPosts.map((latest) => (
              <BlogCard key={latest.id} post={latest} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
