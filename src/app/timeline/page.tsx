"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PostCard from "@/components/PostCard";

interface Post {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isPublic: boolean;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
}

const PAGE_SIZE = 10;

export default function TimelinePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function fetchPosts(cursor?: string) {
    const params = new URLSearchParams({ scope: "public", limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/posts?${params}`);
    if (!res.ok) return;

    const data = await res.json();
    setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
    setHasMore(data.hasMore);
    return data;
  }

  useEffect(() => {
    fetchPosts().finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    if (last) await fetchPosts(last.id);
    setLoadingMore(false);
  }, [posts, loadingMore, hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-deep">Public Timeline</h1>
        <p className="text-deep/60 mt-1">
          Devotional posts from the global saṅga
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-deep/50">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-sand">
          <div className="text-4xl mb-3">📿</div>
          <p className="text-deep/60">
            No public posts yet. Be the first to share!
          </p>
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
            <p className="text-deep/50 text-sm">Loading more...</p>
          ) : (
            <div className="w-6 h-6" />
          )}
        </div>
      )}
    </div>
  );
}
