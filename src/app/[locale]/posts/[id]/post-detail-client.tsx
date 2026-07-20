"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import PostCard from "@/components/PostCard";
import PostLayout from "@/components/PostLayout";
import EditPostModal from "@/components/EditPostModal";
import { useIdentity } from "@/components/IdentityProvider";
import type { Post } from "@/types/post";

export default function PostDetailClient({
  post: initialPost,
}: {
  post: Post | null;
}) {
  const { data: session } = useSession();
  const { identities } = useIdentity();
  const router = useRouter();
  const t = useTranslations("SinglePost");
  const [editedPost, setEditedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const displayedPost =
    editedPost && initialPost && editedPost.id === initialPost.id
      ? editedPost
      : initialPost;

  const handleEdit = useCallback(() => {
    if (!displayedPost) return;
    setEditingPost(displayedPost);
  }, [displayedPost]);

  const handleEditSuccess = useCallback((updatedPost: Post) => {
    setEditedPost(updatedPost);
    setEditingPost(null);
  }, []);
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);

  if (!displayedPost) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-deep/60 mb-4">{t("notFound")}</p>
      </div>
    );
  }

  function handleDelete() {
    router.push("/posts");
  }

  return (
    <PostLayout title={t("title")}>
      <PostCard
        post={displayedPost}
        currentUserId={session?.user?.id}
        manageableChannelIds={manageableChannelIds}
        hideExternalLink
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      <EditPostModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </PostLayout>
  );
}
