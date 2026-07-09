"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import PostCard from "@/components/PostCard";
import PostForm from "@/components/PostForm";
import PostLayout from "@/components/PostLayout";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import type { Post } from "@/types/post";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useTranslations("EditPost");
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    let mounted = true;
    fetch(`/api/posts/${id}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error(t("notFound"));
        if (r.status === 403) throw new Error(t("forbidden"));
        if (!r.ok) throw new Error(t("loadError"));
        return r.json();
      })
      .then((data: Post) => {
        if (!mounted) return;
        if (status !== "authenticated" || session?.user?.id !== data.channel.ownerId) {
          setError(t("forbidden"));
          setLoading(false);
          return;
        }
        setPost(data);
        setLoading(false);
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [id, status, session?.user?.id, t]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="h-6 w-32 bg-sand rounded animate-pulse" />
        <PostCardSkeleton />
        <div className="h-32 bg-sand rounded animate-pulse" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-deep/60 mb-4">{error || t("notFound")}</p>
      </div>
    );
  }

  return (
    <PostLayout postId={id} title={t("title")} backLabel={t("backLink")}>
      <div className="bg-white rounded-lg shadow-md p-6 border border-sand">
        <PostForm
          mode="edit"
          postId={id}
          initialContent={post.content || ""}
          initialIsPublic={post.isPublic}
          initialMedia={post.media}
          onSuccess={() => router.push(`/post/${id}`)}
          onCancel={() => router.push(`/post/${id}`)}
        />
      </div>

      <PostCard post={post} currentUserId={session?.user?.id} hideEdit />
    </PostLayout>
  );
}
