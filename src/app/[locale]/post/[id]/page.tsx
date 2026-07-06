"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import PostCard from "@/components/PostCard";
import PostLayout from "@/components/PostLayout";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import type { Post } from "@/types/post";

export default function SinglePostPage() {
  const { data: session } = useSession();
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("SinglePost");
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/posts/${id}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error(t("notFound"));
        if (!r.ok) throw new Error(t("loadError"));
        return r.json();
      })
      .then((data) => { if (mounted) setPost(data); })
      .catch((e) => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, [id, t]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-deep/60 mb-4">{error}</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <PostCardSkeleton />
      </div>
    );
  }

  return (
    <PostLayout postId={id} title={t("title")} backHref="/posts" backLabel={t("backLink")}>
      <PostCard post={post} currentUserId={session?.user?.id} hideExternalLink />
    </PostLayout>
  );
}
