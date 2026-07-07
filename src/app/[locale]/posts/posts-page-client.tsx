"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PostCard from "@/components/PostCard";
import PostForm from "@/components/PostForm";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { Post } from "@/types/post";

export default function PostsPageClient() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("PostsPage");
  const {
    posts,
    setPosts,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
  } = useInfinitePosts({ language: locale });

  const [allMyPosts, setAllMyPosts] = useState<Post[]>([]);
  const [myPostsError, setMyPostsError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let mounted = true;

    fetch("/api/posts?limit=50")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data) startTransition(() => setAllMyPosts(data.posts));
      })
      .catch(() => { if (mounted) setMyPostsError(true); });

    return () => {
      mounted = false;
    };
  }, [session]);

  const myPublicPosts = useMemo(() => allMyPosts.filter((p) => p.isPublic), [allMyPosts]);
  const myPrivatePosts = useMemo(() => allMyPosts.filter((p) => !p.isPublic), [allMyPosts]);

  function handleCreateSuccess(post: Post) {
    setAllMyPosts((prev) => [post, ...prev]);
    if (post.isPublic) setPosts((prev) => [post, ...prev]);
  }

  function handleDelete(id: string) {
    setAllMyPosts((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-deep">{t("title")}</h1>
        <p className="text-deep/60 mt-1">{t("subtitle")}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-sand mb-6">
        {session ? (
          <PostForm
            mode="create"
            onSuccess={handleCreateSuccess}
          />
        ) : (
          <p className="text-center text-deep/50 py-8">
            <Link href="/login" className="text-saffron hover:text-saffron-dark font-medium underline-offset-2 hover:underline">
              {t("signIn")}
            </Link>{" "}
            {t("signInToPost")}
          </p>
        )}
      </div>

      {session ? (
        <TabsRoot defaultValue="public">
          <TabsList>
            <TabsTab value="public">{t("publicTab")}</TabsTab>
            <TabsTab value="my-public">
              {t("myPublicTab")} ({myPublicPosts.length})
            </TabsTab>
            <TabsTab value="my-private">
              {t("myPrivateTab")} ({myPrivatePosts.length})
            </TabsTab>
          </TabsList>

          <TabsPanel value="public">
            {loading ? (
              <div className="space-y-4">
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-sand">
                <div className="text-4xl mb-3">📿</div>
                <p className="text-deep/60">{t("emptyPublic")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {hasMore && posts.length > 0 && (
              <div ref={sentinelRef} className="flex justify-center py-8">
                {loadingMore ? (
                  <p className="text-deep/50 text-sm">{t("loadingMore")}</p>
                ) : (
                  <div className="w-6 h-6" />
                )}
              </div>
            )}
          </TabsPanel>

          <TabsPanel value="my-public">
            {myPostsError ? (
              <p className="text-center text-red-500 py-8 bg-white rounded-lg border border-sand">
                {t("failedToLoad")}
              </p>
            ) : myPublicPosts.length === 0 ? (
              <p className="text-center text-deep/50 py-8 bg-white rounded-lg border border-sand">
                {t("emptyMyPublic")}
              </p>
            ) : (
              <div className="space-y-4">
                {myPublicPosts.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsPanel>

          <TabsPanel value="my-private">
            {myPostsError ? (
              <p className="text-center text-red-500 py-8 bg-white rounded-lg border border-sand">
                {t("failedToLoad")}
              </p>
            ) : myPrivatePosts.length === 0 ? (
              <p className="text-center text-deep/50 py-8 bg-white rounded-lg border border-sand">
                {t("emptyMyPrivate")}
              </p>
            ) : (
              <div className="space-y-4">
                {myPrivatePosts.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsPanel>
        </TabsRoot>
      ) : (
        <>
          {loading ? (
            <div className="space-y-4">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-sand">
              <div className="text-4xl mb-3">📿</div>
              <p className="text-deep/60">{t("emptyPublic")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {hasMore && posts.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              {loadingMore ? (
                <p className="text-deep/50 text-sm">{t("loadingMore")}</p>
              ) : (
                <div className="w-6 h-6" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
