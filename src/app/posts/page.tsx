"use client";

import { useState, useEffect, startTransition } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import { getYouTubeEmbedUrl } from "@/lib/video";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";

interface Post {
	id: string;
	content: string | null;
	mediaUrl: string | null;
	mediaType: string | null;
	isPublic: boolean;
	createdAt: string;
	author: { id: string; name: string | null; image: string | null };
}

export default function TimelinePage() {
	const { data: session } = useSession();
	const {
		posts,
		setPosts,
		loading,
		loadingMore,
		hasMore,
		sentinelRef,
	} = useInfinitePosts();

	const [content, setContent] = useState("");
	const [isPublic, setIsPublic] = useState(true);
	const [mediaFile, setMediaFile] = useState<File | null>(null);
	const [mediaPreview, setMediaPreview] = useState<string | null>(null);
	const [posting, setPosting] = useState(false);
	const [myPosts, setMyPosts] = useState<Post[]>([]);

	useEffect(() => {
		if (!session) return;
		let mounted = true;

		fetch("/api/posts")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (mounted && data) startTransition(() => setMyPosts(data.posts));
			});

		return () => {
			mounted = false;
		};
	}, [session]);

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setMediaFile(file);
		setMediaPreview(URL.createObjectURL(file));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!session) return;
		const trimmed = content.trim();
		if (!trimmed && !mediaFile) return;
		setPosting(true);

		let postContent = trimmed;
		let mediaUrl: string | null = null;
		let mediaType: string | null = null;

		const embedUrl = getYouTubeEmbedUrl(trimmed);
		if (embedUrl) {
			mediaUrl = embedUrl;
			mediaType = "youtube";
			postContent = trimmed.replace(/https?:\/\/\S*(?:youtube\.com|youtu\.be)\S*/gi, "").trim();
		}

		if (!mediaUrl && mediaFile) {
			const formData = new FormData();
			formData.append("file", mediaFile);
			const uploadRes = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});
			if (uploadRes.ok) {
				const data = await uploadRes.json();
				mediaUrl = data.url;
				mediaType = data.mediaType;
			}
		}

		const res = await fetch("/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: postContent || undefined,
				mediaUrl,
				mediaType,
				isPublic,
			}),
		});

		if (res.ok) {
			const newPost = await res.json();
			setContent("");
			setMediaFile(null);
			setMediaPreview(null);
			fetch("/api/posts")
				.then((r) => (r.ok ? r.json() : null))
				.then((data) => {
					if (data) setMyPosts(data.posts);
				});
			if (isPublic) setPosts((prev) => [newPost, ...prev]);
		}

		setPosting(false);
	}

	const detectedVideo = getYouTubeEmbedUrl(content);

	return (
		<div className="max-w-3xl mx-auto px-4 py-8">
			<div className="text-center mb-8">
				<h1 className="text-3xl font-bold text-deep">Posts</h1>
				<p className="text-deep/60 mt-1">Devotional posts from the global saṅga</p>
			</div>

			<div className="bg-white rounded-lg shadow-md p-6 border border-sand mb-6">
				{session ? (
					<form onSubmit={handleSubmit}>
						<textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Share your realization, a verse, a YouTube link, or a thought..."
							rows={3}
							className="w-full px-4 py-3 rounded-md border border-sand bg-warm/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent resize-none"
						/>

						{detectedVideo && !mediaFile && (
							<div className="mt-3 aspect-video rounded-md overflow-hidden bg-deep/5">
								<iframe
									key={detectedVideo}
									src={detectedVideo}
									className="w-full h-full"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
									referrerPolicy="strict-origin-when-cross-origin"
									title="YouTube preview"
								/>
							</div>
						)}

						{mediaPreview && (
							<div className="mt-3 relative">
								{mediaFile?.type.startsWith("video/") ? (
									<video src={mediaPreview} controls className="max-h-64 rounded-md" />
								) : (
									<img
										src={mediaPreview}
										alt="Preview"
										className="max-h-64 rounded-md object-contain"
									/>
								)}
								<button
									type="button"
									onClick={() => {
										setMediaFile(null);
										setMediaPreview(null);
									}}
									className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-sm hover:bg-red-600"
								>
									✕
								</button>
							</div>
						)}

						<div className="flex items-center justify-between mt-4 flex-wrap gap-3">
							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 text-sm text-deep/70 cursor-pointer hover:text-deep">
									<input
										type="file"
										accept="image/*,video/*"
										onChange={handleFileSelect}
										className="hidden"
									/>
									<span className="text-xl">📎</span>
									Attach Media
								</label>

								<label className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="checkbox"
										checked={isPublic}
										onChange={(e) => setIsPublic(e.target.checked)}
										className="accent-gold"
									/>
									<span className={isPublic ? "text-tulsi" : "text-saffron"}>
										{isPublic ? "Public" : "Private"}
									</span>
								</label>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="submit"
									disabled={posting || (!content.trim() && !mediaFile)}
									className="bg-saffron hover:bg-saffron-dark text-white font-semibold px-6 py-2 rounded-md transition-colors disabled:opacity-50"
								>
									{posting ? "Posting..." : "Share 🙏"}
								</button>
							</div>
						</div>
					</form>
				) : (
					<p className="text-center text-deep/50 py-8">
						<a href="/login" className="text-saffron hover:text-saffron-dark font-medium underline-offset-2 hover:underline">
							Sign in
						</a>{" "}
						to share a post with the saṅga
					</p>
				)}
			</div>

			<TabsRoot defaultValue="public">
				<TabsList>
					<TabsTab value="public">Public posts</TabsTab>
					{session && <TabsTab value="my">My posts</TabsTab>}
				</TabsList>

				<TabsPanel value="public">
					{loading ? (
						<div className="text-center py-12">
							<p className="text-deep/50">Loading posts...</p>
						</div>
					) : posts.length === 0 ? (
						<div className="text-center py-12 bg-white rounded-lg border border-sand">
							<div className="text-4xl mb-3">📿</div>
							<p className="text-deep/60">No public posts yet. Be the first to share!</p>
						</div>
					) : (
						<div className="space-y-4">
							{posts.map((post) => (
								<PostCard key={post.id} post={post} currentUserId={session?.user?.id} />
							))}
						</div>
					)}

					{hasMore && posts.length > 0 && (
						<div ref={sentinelRef} className="flex justify-center py-8">
							{loadingMore ? (
								<p className="text-deep/50 text-sm">Loading more...</p>
							) : (
								<div className="w-6 h-6" />
							)}
						</div>
					)}
				</TabsPanel>

				{session && (
					<TabsPanel value="my">
						{myPosts.length === 0 ? (
							<p className="text-center text-deep/50 py-8 bg-white rounded-lg border border-sand">
								No posts yet.
							</p>
						) : (
							<div className="space-y-4">
								{myPosts.map((post) => (
									<PostCard key={post.id} post={post} currentUserId={session?.user?.id} />
								))}
							</div>
						)}
					</TabsPanel>
				)}
			</TabsRoot>
		</div>
	);
}
