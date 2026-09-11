"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CalendarDays, UserRound } from "lucide-react";
import BlogCard from "@/components/BlogCard";
import { formatBlogDate, getLatestBlogPostsGridClass } from "@/lib/blog";
import type { BlogDetailVariantProps } from "@/types/blog-variants";

/**
 * Magazine: full-bleed cover hero with the title set over the image,
 * meta on a hairline rule, drop-cap excerpt, card grid for latest.
 */
export default function MagazineVariant({ post, contentHtml, latestPosts }: BlogDetailVariantProps) {
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale);

  return (
    <div className="w-full">
      <div className="relative flex min-h-[26rem] items-end overflow-hidden bg-deep">
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt="" aria-hidden={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-deep via-deep/90 to-saffron-dark"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative w-full max-w-3xl mx-auto px-4 pb-8 pt-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">
            <Link href="/blog" className="hover:text-white">
              {t("title")}
            </Link>
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">{post.title}</h1>
          {post.excerpt ? (
            <p className="mt-3 max-w-2xl text-lg text-white/80">{post.excerpt}</p>
          ) : null}
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 border-b border-deep/10 pb-5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold text-lg shrink-0">
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
          {contentHtml ? (
            <div
              className="rich-text mt-6 [&>p:first-of-type::first-letter]:float-left [&>p:first-of-type::first-letter]:mr-2 [&>p:first-of-type::first-letter]:text-6xl [&>p:first-of-type::first-letter]:font-bold [&>p:first-of-type::first-letter]:leading-none [&>p:first-of-type::first-letter]:text-saffron-dark"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : null}
        </article>
        {latestPosts.length > 0 ? (
          <section aria-label={t("latestPosts")} className="mt-12">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold text-deep">{t("latestPosts")}</h2>
              <Link href="/blog" className="shrink-0 text-sm font-medium text-saffron-dark hover:text-gold">
                {t("title")} →
              </Link>
            </div>
            <div className={getLatestBlogPostsGridClass(latestPosts.length)}>
              {latestPosts.map((latest) => (
                <BlogCard key={latest.id} post={latest} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
