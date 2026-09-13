"use client";

import { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import BlogCard from "@/components/BlogCard";
import BlogForm from "@/components/BlogForm";
import EditBlogModal from "@/components/EditBlogModal";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";
import { useIdentity } from "@/components/IdentityProvider";
import CategoryFilterBanner, { ChannelFilterBanner } from "@/components/CategoryFilterBanner";
import type { BlogPost } from "@/types/blog";

export default function BlogPageClient({
  initialPublic,
  channelId,
  channelName,
  category,
}: {
  initialPublic?: { posts: BlogPost[]; hasMore: boolean };
  channelId?: string;
  channelName?: string;
  category?: string;
}) {
  const { data: session } = useSession();
  const { activeChannelId, identities } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const effectiveChannelId = channelId ?? undefined;
  const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef } = useInfiniteBlogPosts({
    scope: "public",
    channelId: effectiveChannelId,
    language: locale,
    category,
    initialData: initialPublic,
  });
  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myLoading,
    loadingMore: myLoadingMore,
    hasMore: myHasMore,
    sentinelRef: mySentinelRef,
  } = useInfiniteBlogPosts({
    channelId: effectiveChannelId ?? activeChannelId ?? undefined,
    disabled: !session || !(effectiveChannelId ?? activeChannelId),
    language: locale,
  });

  const now = useMemo(() => new Date(), []);
  const myPublicPosts = useMemo(
    () => myPosts.filter((p) => p.isPublic && (!p.publishedAt || new Date(p.publishedAt) <= now)),
    [myPosts, now],
  );
  const myPrivatePosts = useMemo(
    () => myPosts.filter((p) => !p.isPublic || (p.publishedAt && new Date(p.publishedAt) > now)),
    [myPosts, now],
  );
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);
  const postingChannel = useMemo(() => {
    const id = effectiveChannelId ?? activeChannelId;
    const identity = identities.find((i) => i.id === id);
    return id && identity ? { id, name: identity.name } : undefined;
  }, [effectiveChannelId, activeChannelId, identities]);

  function handleCreateSuccess(post: BlogPost) {
    setMyPosts((prev) => [post, ...prev]);
    // A filtered feed only shows matching posts: don't prepend a fresh
    // post that doesn't carry the active category or channel.
    if (
      post.isPublic &&
      (!category || post.categories.some((c) => c.name === category)) &&
      (!effectiveChannelId || post.channel.id === effectiveChannelId)
    ) {
      setPosts((prev) => [post, ...prev]);
    }
  }

  function handleDelete(id: string) {
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const handleEdit = useCallback((postId: string) => {
    const found = [...posts, ...myPosts].find((p) => p.id === postId);
    if (found) setEditingPost(found);
  }, [posts, myPosts]);

  const handleEditSuccess = useCallback((updatedPost: BlogPost) => {
    setMyPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    setPosts((prev) => {
      if (updatedPost.isPublic) {
        return prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
      }
      return prev.filter((p) => p.id !== updatedPost.id);
    });
    setEditingPost(null);
  }, [setMyPosts, setPosts]);

  function renderList(
    list: BlogPost[],
    isLoading: boolean,
    isLoadingMore: boolean,
    more: boolean,
    ref: (node: HTMLDivElement | null) => void,
    emptyKey: string,
  ) {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <Card variant="ghost" className="text-center py-12 px-6">
          <p className="text-deep/60">{t(emptyKey)}</p>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {list.map((post) => (
          <BlogCard
            key={post.id}
            post={post}
            currentUserId={session?.user?.id}
            manageableChannelIds={manageableChannelIds}
            onDelete={session ? handleDelete : undefined}
            onEdit={session ? handleEdit : undefined}
          />
        ))}
        {more && list.length > 0 && (
          <div ref={ref} className="flex justify-center py-8">
            {isLoadingMore ? (
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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-deep">{t("title")}</h1>
        <p className="text-deep/60 mt-1">{t("subtitle")}</p>
      </div>

      {category ? <CategoryFilterBanner name={category} href="/blog" /> : null}
      {channelName ? <ChannelFilterBanner name={channelName} href="/blog" /> : null}

      <Card variant="default" padding="lg" className="mb-6">
        {session ? (
          <BlogForm mode="create" onSuccess={handleCreateSuccess} postingChannel={postingChannel} />
        ) : (
          <p className="text-center text-deep/50 py-8">
            <Link
              href="/login"
              className="text-saffron hover:text-saffron-dark font-medium underline-offset-2 hover:underline"
            >
              {t("signIn")}
            </Link>{" "}
            {t("signInToPost")}
          </p>
        )}
      </Card>

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
            {renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic")}
          </TabsPanel>

          <TabsPanel value="my-public">
            {renderList(myPublicPosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPublic")}
          </TabsPanel>

          <TabsPanel value="my-private">
            {renderList(myPrivatePosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPrivate")}
          </TabsPanel>
        </TabsRoot>
      ) : (
        renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic")
      )}

      <EditBlogModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
