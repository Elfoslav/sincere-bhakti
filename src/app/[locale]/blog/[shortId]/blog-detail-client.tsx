"use client";

import { useState, useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation";
import BlogAnalytics from "@/components/BlogAnalytics";
import { isBlogPubliclyVisible } from "@/lib/blog";
import BlogLayout from "@/components/BlogLayout";
import BlogPostActions from "@/components/BlogPostActions";
import CategoryChips from "@/components/CategoryChips";
import EditBlogModal from "@/components/EditBlogModal";
import ChannelAvatar from "@/components/ChannelAvatar";
import OrnamentDivider from "@/components/OrnamentDivider";
import ReadingProgress from "@/components/ReadingProgress";
import ArticleRecommendations from "@/components/ArticleRecommendations";
import { LoadableMedia } from "@/components/ui/loadable-media";
import { useIdentity } from "@/components/IdentityProvider";
import { getBlogUrl } from "@/lib/blog-url";
import { estimateReadingMinutes, formatBlogDate } from "@/lib/blog";
import type { BlogPost, BlogRecommendations } from "@/types/blog";

export default function BlogDetailClient({
  post: initialPost,
  contentHtml,
  recommendations = { channelPosts: [], otherPosts: [] },
}: {
  post: BlogPost | null;
  contentHtml: string;
  recommendations?: BlogRecommendations;
}) {
  const { data: session } = useSession();
  const { identities } = useIdentity();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const homeT = useTranslations("HomePage");
  const [editedPost, setEditedPost] = useState<BlogPost | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const displayedPost =
    editedPost && initialPost && editedPost.id === initialPost.id
      ? editedPost
      : initialPost;

  // The server-rendered HTML tracks the original body; after an in-place
  // edit the PATCH response carries the fresh sanitized HTML.
  const html =
    editedPost && initialPost && editedPost.id === initialPost.id && editedPost.contentHtml
      ? editedPost.contentHtml
      : contentHtml;

  const handleEditSuccess = useCallback((updatedPost: BlogPost, exit: boolean) => {
    const current = editedPost ?? initialPost;
    if (initialPost && updatedPost.id === initialPost.id) {
      if (current && current.slug !== updatedPost.slug) {
        router.replace(getBlogUrl(updatedPost.shortId, updatedPost.slug));
      }
      setEditedPost(updatedPost);
    }
    // Save & stay refreshes the page behind the still-open modal.
    if (exit) setEditingPost(null);
  }, [editedPost, initialPost, router]);
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);

  if (!displayedPost) {
    return (
      <div className="reading-container page-space text-center">
        <p className="text-muted-foreground mb-4">{t("notFound")}</p>
      </div>
    );
  }

  function handleDelete() {
    router.push("/blog");
  }

  const date = formatBlogDate(displayedPost.publishedAt ?? displayedPost.createdAt, locale);
  const isScheduled = displayedPost.publishedAt ? new Date(displayedPost.publishedAt) > new Date() : false;

  const readingMinutes = estimateReadingMinutes(html);

  return (
    <BlogLayout title={displayedPost.title} containerClassName="blog-detail-container page-space">
      <ReadingProgress />
      <div className="blog-reading-grid" data-has-recommendations={Boolean(recommendations.channelPosts.length || recommendations.otherPosts.length)}>
      <article className="blog-reading-article">
        <header className="blog-article-header">
          <CategoryChips categories={displayedPost.categories} onSelect={(category) => router.push(`/blog/category/${category.slug}`)} className="article-row-categories" />
          <h1 className="font-heading blog-article-title">{displayedPost.title}</h1>
          {displayedPost.excerpt && <p className="blog-article-dek font-heading">{displayedPost.excerpt}</p>}
          <div className="blog-article-byline">
            <Link href={`/blog/channel/${displayedPost.channel.slug}`} className="blog-article-author">
              <ChannelAvatar name={displayedPost.channel.name} avatarUrl={displayedPost.channel.avatarUrl} size="sm" ariaHidden />
              <span>{displayedPost.channel.name}</span>
            </Link>
            <div className="blog-article-dateline">
              <time dateTime={displayedPost.publishedAt ?? displayedPost.createdAt}>{date}</time>
              {readingMinutes > 0 && <><span aria-hidden="true">·</span><span>{t("readingTime", { minutes: readingMinutes })}</span></>}
            </div>
            {!displayedPost.isPublic ? (
              <span className="rounded bg-deep/10 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("private")}
              </span>
            ) : isScheduled ? (
              <span className="rounded bg-gold-light/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                {t("scheduled")}
              </span>
            ) : null}
            <BlogPostActions
              post={displayedPost}
              currentUserId={session?.user?.id}
              manageableChannelIds={manageableChannelIds}
              onDelete={handleDelete}
              onEdit={() => setEditingPost(displayedPost)}
            />
          </div>
        </header>
        {displayedPost.coverUrl ? (
          <figure className="blog-article-cover">
            <LoadableMedia key={displayedPost.coverUrl} className="aspect-[16/10]">
              {({ onLoad, onError, ref }) => (
                // eslint-disable-next-line @next/next/no-img-element -- author-supplied covers may use external storage domains
                <img src={displayedPost.coverUrl!} alt={displayedPost.title} className="aspect-[16/10] w-full object-cover" onLoad={onLoad} onError={onError} ref={ref} />
              )}
            </LoadableMedia>
          </figure>
        ) : null}
        {html ? (
          <div
            className="rich-text rich-text-article blog-article-body text-lg"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
        {isBlogPubliclyVisible(displayedPost) && <BlogAnalytics key={displayedPost.id} postId={displayedPost.id} />}
        <footer className="mt-12">
          <OrnamentDivider />
          <CategoryChips
            categories={displayedPost.categories}
            onSelect={(category) => router.push(`/blog/category/${category.slug}`)}
            className="mt-6 justify-center"
          />
        </footer>
      </article>
      {(recommendations.channelPosts.length > 0 || recommendations.otherPosts.length > 0) && (
        <aside className="blog-reading-sidebar" aria-label={t("moreArticles")}>
          <div className="blog-reading-sidebar-inner">
            <ArticleRecommendations title={t("moreFromChannel", { name: displayedPost.channel.name })} posts={recommendations.channelPosts} currentPostId={displayedPost.id} href={`/blog/channel/${displayedPost.channel.slug}`} linkLabel={t("channelArticles")} />
            <ArticleRecommendations title={t("otherChannels")} posts={recommendations.otherPosts} currentPostId={displayedPost.id} href="/blog" linkLabel={homeT("viewAllBlog")} />
          </div>
        </aside>
      )}
      </div>
      <EditBlogModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </BlogLayout>
  );
}
