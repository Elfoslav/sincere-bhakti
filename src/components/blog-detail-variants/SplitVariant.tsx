"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CalendarDays, UserRound } from "lucide-react";
import BlogExcerpt from "@/components/BlogExcerpt";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getBlogUrl } from "@/lib/blog-url";
import { formatBlogDate } from "@/lib/blog";
import type { BlogDetailVariantProps } from "@/types/blog-variants";

/**
 * Split: two-column hero (title + meta left, cover right), article below,
 * latest articles as thumbnail rows.
 */
export default function SplitVariant({ post, contentHtml, latestPosts }: BlogDetailVariantProps) {
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[{ label: t("title"), href: "/blog" }, { label: post.title }]}
        className="mb-6"
        lastClassName="text-lg"
      />
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-saffron-dark">
            <UserRound className="size-4 shrink-0" aria-hidden />
            <Link href={`/channels/${post.channel.slug}`} className="truncate hover:text-gold">
              {post.channel.name}
            </Link>
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-deep">{post.title}</h1>
          {post.excerpt ? <p className="mt-3 text-lg text-deep/70">{post.excerpt}</p> : null}
          <p className="mt-4 flex items-center gap-1.5 text-sm text-deep/60">
            <CalendarDays className="size-4 shrink-0 text-deep/40" aria-hidden />
            {date}
          </p>
        </div>
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={post.title} className="h-72 w-full rounded-xl object-cover shadow-lg shadow-deep/10" />
        ) : (
          <div
            aria-hidden
            className="flex h-72 w-full items-center justify-center rounded-xl bg-gradient-to-br from-gold-light via-saffron to-saffron-dark text-8xl font-bold text-white/85 shadow-lg shadow-deep/10"
          >
            {post.title?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
      <article className="mx-auto mt-10 max-w-3xl">
        {contentHtml ? (
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : null}
      </article>
      {latestPosts.length > 0 ? (
        <section aria-label={t("latestPosts")} className="mx-auto mt-12 max-w-3xl">
          <h2 className="mb-4 text-2xl font-bold text-deep">{t("latestPosts")}</h2>
          <ul className="divide-y divide-deep/10 rounded-xl bg-white ring-1 ring-deep/10">
            {latestPosts.map((latest) => (
              <li key={latest.id} className="flex gap-4 p-4">
                <Link
                  href={getBlogUrl(latest.shortId, latest.slug)}
                  aria-label={latest.title}
                  className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-gold-light to-saffron-dark text-2xl font-bold text-white/85"
                >
                  {latest.title?.[0]?.toUpperCase() || "?"}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={getBlogUrl(latest.shortId, latest.slug)}
                    className="font-bold text-deep hover:text-gold"
                  >
                    {latest.title}
                  </Link>
                  <BlogExcerpt post={latest} className="mt-0.5 text-sm text-deep/70" clampClassName="line-clamp-2" />
                  <p className="mt-1 text-xs text-deep/50">
                    {formatBlogDate(latest.publishedAt ?? latest.createdAt, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
