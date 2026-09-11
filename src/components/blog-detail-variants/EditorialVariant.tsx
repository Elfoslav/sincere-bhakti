"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getBlogUrl } from "@/lib/blog-url";
import { formatBlogDate } from "@/lib/blog";
import type { BlogDetailVariantProps } from "@/types/blog-variants";

/**
 * Editorial: quiet centered column, serif display title, hairline rules,
 * latest articles as a numbered reading list instead of cards.
 */
export default function EditorialVariant({ post, contentHtml, latestPosts }: BlogDetailVariantProps) {
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const date = formatBlogDate(post.publishedAt ?? post.createdAt, locale);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-saffron-dark">
        <Link href={`/channels/${post.channel.slug}`} className="hover:text-gold">
          {post.channel.name}
        </Link>
      </p>
      <h1 className="mt-4 text-center font-serif text-4xl font-bold leading-tight text-deep sm:text-5xl">
        {post.title}
      </h1>
      <p className="mt-4 text-center text-sm text-deep/60">{date}</p>
      <hr className="mx-auto my-8 w-16 border-t-2 border-gold" />
      {post.excerpt ? (
        <p className="text-center font-serif text-xl italic leading-relaxed text-deep/80">{post.excerpt}</p>
      ) : null}
      <article>
        {contentHtml ? (
          <div
            className="rich-text mt-8 text-lg leading-relaxed"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : null}
      </article>
      <hr className="my-10 border-deep/10" />
      {latestPosts.length > 0 ? (
        <section aria-label={t("latestPosts")}>
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-deep/50">
            {t("latestPosts")}
          </h2>
          <ol className="mt-6 divide-y divide-deep/10">
            {latestPosts.map((latest, index) => (
              <li key={latest.id} className="flex items-baseline gap-4 py-4">
                <span aria-hidden className="font-serif text-2xl font-bold text-gold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <Link
                    href={getBlogUrl(latest.shortId, latest.slug)}
                    className="font-serif text-xl font-bold text-deep hover:text-gold"
                  >
                    {latest.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-deep/60">
                    {formatBlogDate(latest.publishedAt ?? latest.createdAt, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
