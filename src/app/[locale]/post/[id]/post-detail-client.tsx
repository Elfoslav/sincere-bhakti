"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import PostCard from "@/components/PostCard";
import PostLayout from "@/components/PostLayout";
import type { Post } from "@/types/post";

export default function PostDetailClient({
  post,
}: {
  post: Post | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("SinglePost");

  if (!post) {
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
    <PostLayout postId={post.id} title={t("title")} backHref="/posts" backLabel={t("backLink")}>
      <PostCard post={post} currentUserId={session?.user?.id} hideExternalLink onDelete={handleDelete} />
    </PostLayout>
  );
}
