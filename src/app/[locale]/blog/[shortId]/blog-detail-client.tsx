"use client";

import { useState, useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation";
import { CalendarDays, UserRound } from "lucide-react";
import BlogLayout from "@/components/BlogLayout";
import BlogCard from "@/components/BlogCard";
import BlogPostActions from "@/components/BlogPostActions";
import EditBlogModal from "@/components/EditBlogModal";
import { useIdentity } from "@/components/IdentityProvider";
import { getBlogUrl } from "@/lib/blog-url";
import { getLatestBlogPostsGridClass } from "@/lib/blog";
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

  const handleEditSuccess = useCallback((updatedPost: BlogPost) => {
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
    setEditingPost(null);
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
      <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-deep/60 mb-4">{t("notFound")}</p>
      </div>
    );
  }

  function handleDelete() {
    router.push("/blog");
  }

  const displayDate = displayedPost.publishedAt ?? displayedPost.createdAt;
  const date = new Date(displayDate).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isScheduled = displayedPost.publishedAt ? new Date(displayedPost.publishedAt) > new Date() : false;

  return (
    <BlogLayout title={displayedPost.title}>
      <div className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold text-lg shrink-0">
          {displayedPost.channel.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-deep">
            <UserRound className="size-4 shrink-0 text-deep/40" aria-hidden />
            <Link
              href={`/channels/${displayedPost.channel.slug}`}
              className="truncate hover:text-gold"
            >
              {displayedPost.channel.name}
            </Link>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-deep/60">
            <CalendarDays className="size-4 shrink-0 text-deep/40" aria-hidden />
            {date}
            {!displayedPost.isPublic ? (
              <span className="rounded bg-deep/10 px-1.5 py-0.5 text-[11px] font-medium text-deep/70">
                {t("private")}
              </span>
            ) : isScheduled ? (
              <span className="rounded bg-gold-light/20 px-1.5 py-0.5 text-[11px] font-medium text-gold-dark">
                {t("scheduled")}
              </span>
            ) : null}
          </p>
        </div>
        <BlogPostActions
          post={displayedPost}
          currentUserId={session?.user?.id}
          manageableChannelIds={manageableChannelIds}
          onDelete={handleDelete}
          onEdit={() => displayedPost && handleEdit(displayedPost.id)}
        />
      </div>
      <article>
        {displayedPost.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayedPost.coverUrl}
            alt={displayedPost.title}
            className="mb-6 h-64 w-full rounded-lg object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-bold text-deep">{displayedPost.title}</h1>
        {displayedPost.excerpt ? (
          <p className="mt-2 text-lg text-deep/70">{displayedPost.excerpt}</p>
        ) : null}
        {html ? (
          <div className="rich-text mt-6" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
      </article>
      {latestPosts.length > 0 ? (
        <section aria-label={t("latestPosts")} className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-deep">{t("latestPosts")}</h2>
          <div className={getLatestBlogPostsGridClass(latestPosts.length)}>
            {latestPosts.map((post) => (
              <BlogCard
                key={post.id}
                post={post}
                currentUserId={session?.user?.id}
                manageableChannelIds={manageableChannelIds}
                onDelete={session ? handleLatestDelete : undefined}
                onEdit={session ? handleEdit : undefined}
              />
            ))}
          </div>
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
