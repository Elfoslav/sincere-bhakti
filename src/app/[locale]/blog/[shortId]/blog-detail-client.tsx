"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import BlogCard from "@/components/BlogCard";
import EditBlogModal from "@/components/EditBlogModal";
import { useIdentity } from "@/components/IdentityProvider";
import { getBlogUrl } from "@/lib/blog-url";
import type { BlogPost } from "@/types/blog";

export default function BlogDetailClient({
  post: initialPost,
}: {
  post: BlogPost | null;
}) {
  const { data: session } = useSession();
  const { identities } = useIdentity();
  const router = useRouter();
  const t = useTranslations("BlogPage");
  const [editedPost, setEditedPost] = useState<BlogPost | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const displayedPost =
    editedPost && initialPost && editedPost.id === initialPost.id
      ? editedPost
      : initialPost;

  const handleEditSuccess = useCallback((updatedPost: BlogPost) => {
    const current = editedPost ?? initialPost;
    if (current && current.slug !== updatedPost.slug) {
      router.replace(getBlogUrl(updatedPost.shortId, updatedPost.slug));
    }
    setEditedPost(updatedPost);
    setEditingPost(null);
  }, [editedPost, initialPost, router]);
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);

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

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
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
        {displayedPost.content ? (
          <div className="mt-6 whitespace-pre-wrap text-deep/90">{displayedPost.content}</div>
        ) : null}
        <div className="mt-8">
          <BlogCard
            post={displayedPost}
            currentUserId={session?.user?.id}
            manageableChannelIds={manageableChannelIds}
            onDelete={handleDelete}
            onEdit={() => setEditingPost(displayedPost)}
          />
        </div>
      </article>
      <EditBlogModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
