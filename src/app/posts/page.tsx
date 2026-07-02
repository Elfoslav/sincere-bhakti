"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import { getYouTubeEmbedUrl } from "@/lib/video";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { Post } from "@/types/post";

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
	const [mediaFiles, setMediaFiles] = useState<File[]>([]);
	const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
	const [posting, setPosting] = useState(false);
	const [myPosts, setMyPosts] = useState<Post[]>([]);
	const [myPostsError, setMyPostsError] = useState(false);

	useEffect(() => {
		if (!session) return;
		let mounted = true;

		fetch("/api/posts")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (mounted && data) startTransition(() => setMyPosts(data.posts));
			})
			.catch(() => { if (mounted) setMyPostsError(true); });

		return () => {
			mounted = false;
		};
	}, [session]);

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []);
		if (files.length === 0) return;
		setMediaFiles((prev) => [...prev, ...files]);
		setMediaPreviews((prev) => [
			...prev,
			...files.map((f) => URL.createObjectURL(f)),
		]);
	}

	const fileInputRef = useRef<HTMLInputElement>(null);

	function removeFile(index: number) {
		setMediaFiles((prev) => prev.filter((_, i) => i !== index));
		setMediaPreviews((prev) => {
			if (prev[index]) URL.revokeObjectURL(prev[index]);
			return prev.filter((_, i) => i !== index);
		});
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!session) return;
		const trimmed = content.trim();
		if (!trimmed && mediaFiles.length === 0) return;
		setPosting(true);

		const media: { url: string; type: string }[] = [];

		const youtubeUrl = getYouTubeEmbedUrl(trimmed);
		if (youtubeUrl) {
			media.push({ url: youtubeUrl, type: "youtube" });
		}

		let uploadFailed = false;

		if (mediaFiles.length > 0) {
			const uploads = mediaFiles.map(async (file) => {
				let res: Response;
				try {
					res = await fetch("/api/upload-url", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							fileName: file.name,
							contentType: file.type,
						}),
					});
				} catch {
					return null;
				}
				if (!res.ok) return null;
				const { uploadUrl, publicUrl, mediaType: mt } = await res.json();
				let putRes: Response;
				try {
					putRes = await fetch(uploadUrl, {
						method: "PUT",
						body: file,
						headers: { "Content-Type": file.type || "application/octet-stream" },
					});
				} catch {
					return null;
				}
				if (!putRes.ok) return null;
				return { url: publicUrl, type: mt };
			});

			const results = await Promise.allSettled(uploads);
			for (const r of results) {
				if (r.status === "fulfilled" && r.value) media.push(r.value);
				else uploadFailed = true;
			}

			if (uploadFailed) {
				toast.error("Upload failed. Please try again.");
				setPosting(false);
				return;
			}
		}

		if (!trimmed && media.length === 0) {
			toast.error("Nothing to post — add text or media");
			setPosting(false);
			return;
		}

		const postContent = youtubeUrl
			? trimmed.replace(/https?:\/\/\S*(?:youtube\.com|youtu\.be)\S*/gi, "").trim()
			: trimmed;

		try {
			const res = await fetch("/api/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: postContent || undefined,
					media: media.length > 0 ? media : undefined,
					isPublic,
				}),
			});

			if (res.ok) {
				const newPost = await res.json();
				setContent("");
				setMediaFiles([]);
				setMediaPreviews((prev) => { prev.forEach(URL.revokeObjectURL); return []; });
				if (fileInputRef.current) fileInputRef.current.value = "";
				setMyPosts((prev) => [newPost, ...prev]);
				if (isPublic) setPosts((prev) => [newPost, ...prev]);
				toast.success("Post published");
			} else {
				const err = await res.json().catch(() => ({ error: "Failed to create post" }));
				toast.error(err.error);
			}
		} catch {
			toast.error("Failed to create post");
		}

		setPosting(false);
	}

	const detectedVideo = mediaFiles.length === 0 ? getYouTubeEmbedUrl(content) : null;

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

						{detectedVideo && mediaFiles.length === 0 && (
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

						{mediaPreviews.length > 0 && (
							<div className="mt-3 grid grid-cols-2 gap-2">
								{mediaPreviews.map((preview, i) => (
									<div key={preview} className="relative group">
										{mediaFiles[i]?.type.startsWith("video/") ? (
											<video src={preview} controls className="max-h-64 rounded-md w-full object-contain" />
										) : (
											<img src={preview} alt="Preview" className="max-h-64 rounded-md w-full object-contain" />
										)}
										<button
											type="button"
											onClick={() => removeFile(i)}
											className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
										>
											✕
										</button>
									</div>
								))}
							</div>
						)}

						<div className="flex items-center justify-between mt-4 flex-wrap gap-3">
							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 text-sm text-deep/70 cursor-pointer hover:text-deep">
									<input
										ref={fileInputRef}
										type="file"
										multiple
										accept="image/*,video/*"
										onChange={handleFileSelect}
										className="hidden"
									/>
									<span className="text-xl">📎</span>
									{mediaFiles.length > 0 ? `Media (${mediaFiles.length})` : "Attach Media"}
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
									disabled={posting || (!content.trim() && mediaFiles.length === 0)}
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
						{myPostsError ? (
							<p className="text-center text-red-500 py-8 bg-white rounded-lg border border-sand">
								Failed to load your posts.
							</p>
						) : myPosts.length === 0 ? (
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
