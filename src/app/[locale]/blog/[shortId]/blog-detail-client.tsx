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
import { Card } from "@/components/ui/card";
import { useIdentity } from "@/components/IdentityProvider";
import { getBlogUrl } from "@/lib/blog-url";
import { formatBlogDate } from "@/lib/blog";
import type { BlogPost } from "@/types/blog";

export default function BlogDetailClient({
  post: initialPost,
  contentHtml,
  latestPosts: initialLatestPosts = [],
}: {
  post: BlogPost | null;
  contentHtml: string;
  latestPosts?: BlogPost[];
}) {
  const { data: session } = useSession();
  const { identities } = useIdentity();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const [editedPost, setEditedPost] = useState<BlogPost | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>(initialLatestPosts);

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
    } else {
      setLatestPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
      );
    }
    // Save & stay refreshes the page behind the still-open modal.
    if (exit) setEditingPost(null);
  }, [editedPost, initialPost, router]);
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);

  function handleLatestDelete(id: string) {
    setLatestPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const handleEdit = useCallback((postId: string) => {
    if (displayedPost && postId === displayedPost.id) {
      setEditingPost(displayedPost);
      return;
    }
    const found = latestPosts.find((p) => p.id === postId);
    if (found) setEditingPost(found);
  }, [displayedPost, latestPosts]);

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

  return (
    <BlogLayout title={displayedPost.title} containerClassName="reading-container page-space">
      {/* Shared reading surface follows the active semantic palette. */}
      <Card variant="default" padding="lg">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-saffron-dark">
        <Link href={`/blog/channel/${displayedPost.channel.slug}`} className="hover:text-gold">
          {displayedPost.channel.name}
        </Link>
      </p>
      <h1 className="type-title mt-4 text-center">
        {displayedPost.title}
      </h1>
      {/* div, not p: BlogPostActions renders a div (invalid inside a
      paragraph and a hydration error). */}
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        {date}
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
          onEdit={() => displayedPost && handleEdit(displayedPost.id)}
        />
      </div>
      <hr className="mx-auto my-8 w-16 border-t-2 border-gold" />
      {displayedPost.excerpt ? (
        <p className="text-center font-heading text-xl italic leading-relaxed text-deep/80">
          {displayedPost.excerpt}
        </p>
      ) : null}
      {displayedPost.coverUrl ? (
        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayedPost.coverUrl}
            alt={displayedPost.title}
            className="aspect-video w-full rounded-lg object-cover"
          />
        </figure>
      ) : null}
      <article>
        {html ? (
          <div
            className="rich-text mt-8 text-base leading-normal"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      {isBlogPubliclyVisible(displayedPost) && <BlogAnalytics key={displayedPost.id} postId={displayedPost.id} />}
      </article>
      <CategoryChips
        categories={displayedPost.categories}
        onSelect={(category) => router.push(`/blog/category/${category.slug}`)}
        className="mt-8 justify-center"
      />
      </Card>
      <hr className="my-10 border-deep/10" />
      {latestPosts.length > 0 ? (
        <section aria-label={t("latestPosts")}>
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {t("latestPosts")}
          </h2>
          <ol className="mt-6 divide-y divide-deep/10">
            {latestPosts.map((post, index) => (
              <li key={post.id} className="flex items-center gap-4 py-4">
                <span aria-hidden className="shrink-0 font-heading text-2xl text-gold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={getBlogUrl(post.shortId, post.slug)}
                    className="font-heading text-xl text-deep hover:text-gold"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {formatBlogDate(post.publishedAt ?? post.createdAt, locale)}
                  </p>
                </div>
                <BlogPostActions
                  post={post}
                  currentUserId={session?.user?.id}
                  manageableChannelIds={manageableChannelIds}
                  onDelete={session ? handleLatestDelete : undefined}
                  onEdit={session ? handleEdit : undefined}
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <EditBlogModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </BlogLayout>
  );
}
