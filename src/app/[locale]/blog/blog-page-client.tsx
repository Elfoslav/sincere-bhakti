"use client";

import { useMemo, useState, useCallback } from "react";
import { isAuthenticated } from "@/lib/session";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import ArticleFeedLayout from "@/components/ArticleFeedLayout";
import BlogCard from "@/components/BlogCard";
import ContentCreateAction from "@/components/ContentCreateAction";
import ContentCreationDialog from "@/components/ContentCreationDialog";
import EditBlogModal from "@/components/EditBlogModal";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfiniteBlogPosts } from "@/lib/hooks/useInfiniteBlogPosts";
import { useIdentity } from "@/components/IdentityProvider";
import FeedPaginationError from "@/components/FeedPaginationError";
import FeedEmptyState from "@/components/FeedEmptyState";
import { useFeedSearch } from "@/lib/hooks/useFeedSearch";
import { isBlogPubliclyVisible } from "@/lib/blog";
import { matchesSearch } from "@/lib/feed-search";
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
  const { data: session, status } = useSession();
  const authenticated = isAuthenticated(status);
  const { activeChannelId, identities } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("BlogPage");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const effectiveChannelId = channelId ?? undefined;
  const { searchInput, setSearchInput, search, clearSearch } = useFeedSearch();
  const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef, error, retry, loadMoreError, retryLoadMore } = useInfiniteBlogPosts({
    scope: "public",
    channelId: effectiveChannelId,
    language: locale,
    category,
    search,
    initialData: initialPublic,
  });
  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myLoading,
    loadingMore: myLoadingMore,
    hasMore: myHasMore,
    sentinelRef: mySentinelRef,
    error: myError,
    retry: myRetry,
    loadMoreError: myLoadMoreError,
    retryLoadMore: myRetryLoadMore,
  } = useInfiniteBlogPosts({
    channelId: effectiveChannelId ?? activeChannelId ?? undefined,
    disabled: !authenticated || !(effectiveChannelId ?? activeChannelId),
    language: locale,
    search,
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
    // Private drafts save repeatedly into the same article: upsert so
    // continued saves update the row instead of prepending duplicates. A
    // draft that just went public also appears in the public feed.
    // A filtered feed only shows matching posts: don't prepend a fresh
    // article that doesn't match the active search.
    const matches = matchesSearch(search, post.title, post.excerpt);
    setMyPosts((prev) => (prev.some((p) => p.id === post.id) ? prev.map((p) => (p.id === post.id ? post : p)) : matches ? [post, ...prev] : prev));
    // A filtered feed only shows matching posts: don't prepend a fresh
    // post that doesn't carry the active category or channel.
    if (
      matches &&
      isBlogPubliclyVisible(post) &&
      (!category || post.categories.some((c) => c.name === category)) &&
      (!effectiveChannelId || post.channel.id === effectiveChannelId)
    ) {
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev.map((p) => (p.id === post.id ? post : p)) : [post, ...prev]));
    } else if (!isBlogPubliclyVisible(post)) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
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

  const handleEditSuccess = useCallback((updatedPost: BlogPost, exit: boolean) => {
    setMyPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    setPosts((prev) => {
      if (isBlogPubliclyVisible(updatedPost)) {
        return prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
      }
      return prev.filter((p) => p.id !== updatedPost.id);
    });
    // Save & stay refreshes the lists behind the still-open modal.
    if (exit) setEditingPost(null);
  }, [setMyPosts, setPosts]);

  function renderList(
    list: BlogPost[],
    isLoading: boolean,
    isLoadingMore: boolean,
    more: boolean,
    ref: (node: HTMLDivElement | null) => void,
    emptyKey: string,
    failed = false,
    recover?: () => void,
    moreFailed = false,
    recoverMore?: () => void,
  ) {
    if (isLoading) {
      return (
        <div className="flex flex-col">
          <PostCardSkeleton variant="article" featured={emptyKey === "emptyPublic" && !search && !category} />
          <PostCardSkeleton variant="article" />
          <PostCardSkeleton variant="article" />
        </div>
      );
    }
    if (list.length === 0) {
      return <FeedEmptyState search={search} category={emptyKey === "emptyPublic" ? category : undefined} clearCategoryHref="/blog" onClearSearch={clearSearch} message={t(emptyKey)} error={failed} onRetry={recover} />;
    }
    return (
      <div className="flex flex-col">
        {list.map((post, index) => (
          <BlogCard
            key={post.id}
            post={post}
            variant="list"
            featured={emptyKey === "emptyPublic" && index === 0 && !search && !category}
            currentUserId={session?.user?.id}
            manageableChannelIds={manageableChannelIds}
            onDelete={authenticated ? handleDelete : undefined}
            onEdit={authenticated ? handleEdit : undefined}
          />
        ))}
        <FeedPaginationError error={moreFailed} retry={recoverMore} />
        {more && list.length > 0 && (
          <div ref={ref} className="flex justify-center py-8">
            {isLoadingMore ? (
              <p className="text-muted-foreground text-sm">{t("loadingMore")}</p>
            ) : (
              <div className="w-6 h-6" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <ArticleFeedLayout search={searchInput} onSearchChange={setSearchInput} loading={Boolean(search) && loading} category={category} channelName={channelName} authenticated={authenticated}
      action={<ContentCreateAction kind="article" authenticated={authenticated} onClick={() => setComposerOpen(true)} />}>
      <ContentCreationDialog kind="article" open={composerOpen} onOpenChange={setComposerOpen} onSuccess={handleCreateSuccess} postingChannel={postingChannel} />
      {authenticated ? (
        <TabsRoot defaultValue="public">
          <TabsList>
            <TabsTab value="public">{t("publicTab")}</TabsTab>
            <TabsTab value="my-public">
              {t("myPublicTab")}{!search && ` (${myPublicPosts.length})`}
            </TabsTab>
            <TabsTab value="my-private">
              {t("myPrivateTab")}{!search && ` (${myPrivatePosts.length})`}
            </TabsTab>
          </TabsList>

          <TabsPanel value="public">
            {renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic", error, retry, loadMoreError, retryLoadMore)}
          </TabsPanel>

          <TabsPanel value="my-public">
            {renderList(myPublicPosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPublic", myError, myRetry, myLoadMoreError, myRetryLoadMore)}
          </TabsPanel>

          <TabsPanel value="my-private">
            {renderList(myPrivatePosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPrivate", myError, myRetry, myLoadMoreError, myRetryLoadMore)}
          </TabsPanel>
        </TabsRoot>
      ) : (
        renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic", error, retry, loadMoreError, retryLoadMore)
      )}

      <EditBlogModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </ArticleFeedLayout>
  );
}
