"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PostCard from "@/components/PostCard";

function getYouTubeEmbedUrl(text: string): string | null {
  const match = text.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

interface Post {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isPublic: boolean;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState<"create" | "my-posts">("create");

  const detectedVideo = useMemo(() => getYouTubeEmbedUrl(content), [content]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchMyPosts();
  }, [session]);

  async function fetchMyPosts() {
    const res = await fetch("/api/posts");
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      postContent = trimmed
        .replace(
          /https?:\/\/\S*(?:youtube\.com|youtu\.be)\S*/gi,
          ""
        )
        .trim();
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
      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
      fetchMyPosts();
    }

    setPosting(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((p) => p.filter((post) => post.id !== id));
  }

  const hasContent = content.trim().length > 0 || !!mediaFile;

  if (status === "loading") {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <p className="text-deep/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-deep">
          Welcome, {session?.user?.name || "Devotee"}
        </h1>
        <p className="text-deep/60 mt-1">Hare Kṛṣṇa! Share your bhakti.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-sand/50 rounded-lg p-1">
        <button
          onClick={() => setTab("create")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "create"
              ? "bg-white shadow text-deep"
              : "text-deep/60 hover:text-deep"
          }`}
        >
          Create Post
        </button>
        <button
          onClick={() => setTab("my-posts")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "my-posts"
              ? "bg-white shadow text-deep"
              : "text-deep/60 hover:text-deep"
          }`}
        >
          My Posts ({posts.length})
        </button>
      </div>

      {tab === "create" && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 border border-sand mb-8">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your realization, a verse, a YouTube link, or a thought..."
            rows={4}
            className="w-full px-4 py-3 rounded-md border border-sand bg-warm/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent resize-none"
          />

          {detectedVideo && !mediaFile && (
            <div className="mt-3 relative aspect-video rounded-md overflow-hidden bg-deep/5">
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
                <video
                  src={mediaPreview}
                  controls
                  className="max-h-64 rounded-md"
                />
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

            <button
              type="submit"
              disabled={posting || !hasContent}
              className="bg-saffron hover:bg-saffron-dark text-white font-semibold px-6 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {posting ? "Posting..." : "Share 🙏"}
            </button>
          </div>
        </form>
      )}

      {tab === "my-posts" && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-center text-deep/50 py-12">
              No posts yet. Start sharing your bhakti!
            </p>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={handleDelete} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
