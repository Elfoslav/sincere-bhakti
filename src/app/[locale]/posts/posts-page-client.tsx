"use client";

import { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import PostCard from "@/components/PostCard";
import PostForm from "@/components/PostForm";
import EditPostModal from "@/components/EditPostModal";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { Post } from "@/types/post";

export default function PostsPageClient({
	initialPublic,
}: {
	initialPublic?: { posts: Post[]; hasMore: boolean };
}) {
	const { data: session } = useSession();
	const locale = useLocale();
	const t = useTranslations("PostsPage");
	const [editingPost, setEditingPost] = useState<Post | null>(null);
	const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef } = useInfinitePosts({
		scope: "public",
		language: locale,
		initialData: initialPublic,
	});
	const {
		posts: myPosts,
		setPosts: setMyPosts,
		loading: myLoading,
		loadingMore: myLoadingMore,
		hasMore: myHasMore,
		sentinelRef: mySentinelRef,
	} = useInfinitePosts({
		channelId: session?.user?.channelId,
		disabled: !session,
		language: locale,
	});

	const myPublicPosts = useMemo(() => myPosts.filter((p) => p.isPublic), [myPosts]);
	const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);

	function handleCreateSuccess(post: Post) {
		setMyPosts((prev) => [post, ...prev]);
		if (post.isPublic) setPosts((prev) => [post, ...prev]);
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
		setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
		setEditingPost(null);
	}, [setMyPosts, setPosts]);

	return (
		<div className="w-full max-w-3xl mx-auto px-4 py-8">
			<div className="text-center mb-8">
				<h1 className="text-3xl font-bold text-deep">{t("title")}</h1>
				<p className="text-deep/60 mt-1">{t("subtitle")}</p>
			</div>

			<Card variant="default" padding="lg" className="mb-6">
				{session ? (
					<PostForm mode="create" onSuccess={handleCreateSuccess} />
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
						{loading ? (
							<div className="space-y-4">
								<PostCardSkeleton />
								<PostCardSkeleton />
								<PostCardSkeleton />
							</div>
						) : posts.length === 0 ? (
							<Card variant="ghost" className="text-center py-12 px-6">
								<div className="text-4xl mb-3">📿</div>
								<p className="text-deep/60">{t("emptyPublic")}</p>
							</Card>
						) : (
							<div className="space-y-4">
								{posts.map((post) => (
									<PostCard
										key={post.id}
										post={post}
										currentUserId={session?.user?.id}
										onDelete={handleDelete}
										onEdit={handleEdit}
									/>
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
						{!session ? null : myLoading ? (
							<div className="space-y-4">
								<PostCardSkeleton />
								<PostCardSkeleton />
								<PostCardSkeleton />
							</div>
						) : (
							<div>
								{myPublicPosts.length === 0 ? (
									<Card variant="ghost" className="text-center py-8 text-deep/50">
										{t("emptyMyPublic")}
									</Card>
								) : (
									<div className="space-y-4">
									{myPublicPosts.map((post) => (
										<PostCard
											key={post.id}
											post={post}
											currentUserId={session?.user?.id}
											onDelete={handleDelete}
											onEdit={handleEdit}
										/>
									))}
									</div>
								)}
								{myHasMore && (
									<div ref={mySentinelRef} className="flex justify-center py-8">
										{myLoadingMore ? (
											<p className="text-deep/50 text-sm">{t("loadingMore")}</p>
										) : (
											<div className="w-6 h-6" />
										)}
									</div>
								)}
							</div>
						)}
					</TabsPanel>

					<TabsPanel value="my-private">
						{!session ? null : myLoading ? (
							<div className="space-y-4">
								<PostCardSkeleton />
								<PostCardSkeleton />
								<PostCardSkeleton />
							</div>
						) : (
							<div>
								{myPrivatePosts.length === 0 ? (
									<Card variant="ghost" className="text-center py-8 text-deep/50">
										{t("emptyMyPrivate")}
									</Card>
								) : (
									<div className="space-y-4">
									{myPrivatePosts.map((post) => (
										<PostCard
											key={post.id}
											post={post}
											currentUserId={session?.user?.id}
											onDelete={handleDelete}
											onEdit={handleEdit}
										/>
									))}
									</div>
								)}
								{myHasMore && (
									<div ref={mySentinelRef} className="flex justify-center py-8">
										{myLoadingMore ? (
											<p className="text-deep/50 text-sm">{t("loadingMore")}</p>
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
					{loading ? (
						<div className="space-y-4">
							<PostCardSkeleton />
							<PostCardSkeleton />
							<PostCardSkeleton />
						</div>
					) : posts.length === 0 ? (
						<Card variant="ghost" className="text-center py-12 px-6">
							<div className="text-4xl mb-3">📿</div>
							<p className="text-deep/60">{t("emptyPublic")}</p>
						</Card>
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

			<EditPostModal
				post={editingPost}
				open={editingPost !== null}
				onOpenChange={(open) => { if (!open) setEditingPost(null); }}
				onSuccess={handleEditSuccess}
			/>
		</div>
	);
}
