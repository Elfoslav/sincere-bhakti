"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import PostCard from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { Post } from "@/types/post";
import type { ChannelWithPostCount } from "@/types/channel";

export default function ChannelPageClient({
  channel,
}: {
  channel: ChannelWithPostCount;
}) {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("ChannelPage");
  const isOwner = session?.user?.id === channel.ownerId;

  const {
    posts: publicPosts,
    setPosts: setPublicPosts,
    loading: publicLoading,
    loadingMore: publicLoadingMore,
    hasMore: publicHasMore,
    sentinelRef: publicSentinelRef,
  } = useInfinitePosts({ channelId: channel.id, language: locale });

  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myPostsLoading,
    loadingMore: myPostsLoadingMore,
    hasMore: myPostsHasMore,
    sentinelRef: myPostsSentinelRef,
  } = useInfinitePosts({ channelId: channel.id, scope: "private", disabled: !isOwner, language: locale });

  const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);

  const handleDelete = useCallback((id: string) => {
    setPublicPosts((prev) => prev.filter((p) => p.id !== id));
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  }, [setPublicPosts, setMyPosts]);

  function renderPostList(
    posts: Post[],
    loading: boolean,
    loadingMore: boolean,
    hasMore: boolean,
    sentinelRef: (node: HTMLDivElement | null) => void,
    emptyKey: string,
  ) {
    if (loading) {
      return (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      );
    }
    if (posts.length === 0) {
      return (
        <p className="text-center text-deep/50 py-8 bg-white/60 rounded-lg border border-sand">
          {t(emptyKey)}
        </p>
      );
    }
    return (
      <div>
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={isOwner ? session?.user?.id : undefined} onDelete={handleDelete} />
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            {loadingMore ? (
              <p className="text-deep/50 text-sm">{t("loadingMore")}</p>
            ) : (
              <div className="w-6 h-6" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6 border border-sand mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gold flex items-center justify-center text-deep text-3xl font-bold mx-auto mb-4">
          {channel.name[0]?.toUpperCase() || "?"}
        </div>
        <h1 className="text-2xl font-bold text-deep">{channel.name}</h1>
        <p className="text-deep/50 text-sm mt-2">
          {channel.postCount} {t("posts")}
        </p>
      </div>

      {isOwner ? (
        <TabsRoot defaultValue="public">
          <TabsList>
            <TabsTab value="public">{t("publicPosts", { count: publicPosts.length })}</TabsTab>
            <TabsTab value="private">{t("privatePosts", { count: myPrivatePosts.length })}</TabsTab>
          </TabsList>

          <TabsPanel value="public">
            {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPublicPosts")}
          </TabsPanel>

          <TabsPanel value="private">
            {renderPostList(myPrivatePosts, myPostsLoading, myPostsLoadingMore, myPostsHasMore, myPostsSentinelRef, "noPrivatePosts")}
          </TabsPanel>
        </TabsRoot>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-deep mb-4">
            {t("publicPosts", { count: publicPosts.length })}
          </h2>
          {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPublicPosts")}
        </>
      )}
    </div>
  );
}
