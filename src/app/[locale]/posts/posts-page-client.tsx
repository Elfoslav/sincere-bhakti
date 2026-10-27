"use client";

import { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import PostCard from "@/components/PostCard";
import ContentCreateAction from "@/components/ContentCreateAction";
import ContentCreationDialog from "@/components/ContentCreationDialog";
import EditPostModal from "@/components/EditPostModal";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import { useIdentity } from "@/components/IdentityProvider";
import CategoryFilterBanner from "@/components/CategoryFilterBanner";
import FeedFilterBar from "@/components/FeedFilterBar";
import FeedPaginationError from "@/components/FeedPaginationError";
import FeedEmptyState from "@/components/FeedEmptyState";
import { useFeedSearch } from "@/lib/hooks/useFeedSearch";
import { matchesSearch } from "@/lib/feed-search";
import { isAuthenticated } from "@/lib/session";
import type { Post } from "@/types/post";
import PostsJournalLayout from "@/components/PostsJournalLayout";

export default function PostsPageClient({
	initialPublic,
	category,
}: {
	initialPublic?: { posts: Post[]; hasMore: boolean };
	category?: string;
}) {
	const { data: session, status } = useSession();
  const authenticated = isAuthenticated(status);
	const { activeChannelId, identities } = useIdentity();
	const locale = useLocale();
	const t = useTranslations("PostsPage");
	const [composerOpen, setComposerOpen] = useState(false);
	const [editingPost, setEditingPost] = useState<Post | null>(null);
	const { searchInput, setSearchInput, search } = useFeedSearch();
	const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef, error, retry, loadMoreError, retryLoadMore } = useInfinitePosts({
		scope: "public",
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
	} = useInfinitePosts({
		channelId: activeChannelId ?? undefined,
		disabled: !authenticated || !activeChannelId,
		language: locale,
		search,
	});

	const myPublicPosts = useMemo(() => myPosts.filter((p) => p.isPublic), [myPosts]);
	const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);
	const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);

	function handleCreateSuccess(post: Post) {
		// A filtered feed only shows matching posts: don't prepend a fresh
		// post that doesn't carry the active category or match the search.
		const matches = matchesSearch(search, post.content);
		if (matches) setMyPosts((prev) => [post, ...prev]);
		if (matches && post.isPublic && (!category || post.categories.some((c) => c.name === category))) {
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

	const handleEditSuccess = useCallback((updatedPost: Post) => {
		setMyPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
		setPosts((prev) => {
			if (updatedPost.isPublic) {
				return prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
			}
			return prev.filter((p) => p.id !== updatedPost.id);
		});
		setEditingPost(null);
	}, [setMyPosts, setPosts]);

  const channels = useMemo(() => [...new Map(posts.map((post) => [post.channel.id, post.channel])).values()].slice(0, 4), [posts]);

	return (
    <PostsJournalLayout channels={channels} authenticated={authenticated}
      action={<ContentCreateAction kind="post" authenticated={authenticated} onClick={() => setComposerOpen(true)} />}
      filters={<>
        {category ? <CategoryFilterBanner name={category} href="/posts" /> : null}
			<FeedFilterBar
				search={searchInput}
				onSearchChange={setSearchInput}
				searchPlaceholder={t("searchPlaceholder")}
				variant="editorial"
				basePath="/posts"
				activeCategory={category}
				loading={Boolean(search) && loading}
			/>

      </>}
    >
      <ContentCreationDialog kind="post" open={composerOpen} onOpenChange={setComposerOpen} onSuccess={handleCreateSuccess} />

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
            <FeedPaginationError error={loadMoreError} retry={retryLoadMore} />
						{loading ? (
							<div className="flex flex-col">
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
							</div>
						) : posts.length === 0 ? (
							<FeedEmptyState search={search} message={t("emptyPublic")} error={error} onRetry={retry} />
						) : (
							<div className="flex flex-col">
								{posts.map((post) => (
									<PostCard
                    variant="journal"
										key={post.id}
										post={post}
										currentUserId={session?.user?.id}
										manageableChannelIds={manageableChannelIds}
										onDelete={handleDelete}
										onEdit={handleEdit}
									/>
								))}
							</div>
						)}

						{hasMore && posts.length > 0 && (
							<div ref={sentinelRef} className="flex justify-center py-8">
								{loadingMore ? (
									<p className="text-muted-foreground text-sm">{t("loadingMore")}</p>
								) : (
									<div className="w-6 h-6" />
								)}
							</div>
						)}
					</TabsPanel>

					<TabsPanel value="my-public">
            <FeedPaginationError error={myLoadMoreError} retry={myRetryLoadMore} />
						{!authenticated ? null : myLoading ? (
							<div className="flex flex-col">
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
							</div>
						) : (
							<div>
								{myPublicPosts.length === 0 ? (
									<FeedEmptyState compact search={search} message={t("emptyMyPublic")} error={myError} onRetry={myRetry} />
								) : (
									<div className="flex flex-col">
									{myPublicPosts.map((post) => (
										<PostCard
                    variant="journal"
											key={post.id}
											post={post}
											currentUserId={session?.user?.id}
											manageableChannelIds={manageableChannelIds}
											onDelete={handleDelete}
											onEdit={handleEdit}
										/>
									))}
									</div>
								)}
								{myHasMore && (
									<div ref={mySentinelRef} className="flex justify-center py-8">
										{myLoadingMore ? (
											<p className="text-muted-foreground text-sm">{t("loadingMore")}</p>
										) : (
											<div className="w-6 h-6" />
										)}
									</div>
								)}
							</div>
						)}
					</TabsPanel>

					<TabsPanel value="my-private">
            <FeedPaginationError error={myLoadMoreError} retry={myRetryLoadMore} />
						{!authenticated ? null : myLoading ? (
							<div className="flex flex-col">
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
								<PostCardSkeleton variant="journal" />
							</div>
						) : (
							<div>
								{myPrivatePosts.length === 0 ? (
									<FeedEmptyState compact search={search} message={t("emptyMyPrivate")} error={myError} onRetry={myRetry} />
								) : (
									<div className="flex flex-col">
									{myPrivatePosts.map((post) => (
										<PostCard
                    variant="journal"
											key={post.id}
											post={post}
											currentUserId={session?.user?.id}
											manageableChannelIds={manageableChannelIds}
											onDelete={handleDelete}
											onEdit={handleEdit}
										/>
									))}
									</div>
								)}
								{myHasMore && (
									<div ref={mySentinelRef} className="flex justify-center py-8">
										{myLoadingMore ? (
											<p className="text-muted-foreground text-sm">{t("loadingMore")}</p>
										) : (
											<div className="w-6 h-6" />
										)}
									</div>
								)}
							</div>
						)}
					</TabsPanel>
				</TabsRoot>
			) : (
				<>
            <FeedPaginationError error={loadMoreError} retry={retryLoadMore} />
					{loading ? (
						<div className="flex flex-col">
							<PostCardSkeleton variant="journal" />
							<PostCardSkeleton variant="journal" />
							<PostCardSkeleton variant="journal" />
						</div>
					) : posts.length === 0 ? (
						<FeedEmptyState search={search} message={t("emptyPublic")} error={error} onRetry={retry} />
					) : (
						<div className="flex flex-col">
							{posts.map((post) => (
								<PostCard variant="journal" key={post.id} post={post} />
							))}
						</div>
					)}

					{hasMore && posts.length > 0 && (
						<div ref={sentinelRef} className="flex justify-center py-8">
							{loadingMore ? (
								<p className="text-muted-foreground text-sm">{t("loadingMore")}</p>
							) : (
								<div className="w-6 h-6" />
							)}
						</div>
					)}
				</>
			)}

			<EditPostModal
				post={editingPost}
				open={editingPost !== null}
				onOpenChange={(open) => { if (!open) setEditingPost(null); }}
				onSuccess={handleEditSuccess}
			/>
    </PostsJournalLayout>
	);
}
