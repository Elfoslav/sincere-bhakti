import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import type { Post } from "@/types/post";

const PAGE_SIZE = 10;

type ApiParams = {
  authorId?: string;
  disabled?: boolean;
  pageSize?: number;
};

export function useInfinitePosts(params?: ApiParams) {
  const { authorId, disabled, pageSize = PAGE_SIZE } = params ?? {};
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!disabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      try {
        const query = new URLSearchParams({
          scope: "public",
          limit: String(pageSize),
        });
        if (cursor) query.set("cursor", cursor);
        if (authorId) query.set("authorId", authorId);

        const res = await fetch(`/api/posts?${query}`);
        if (!res.ok) return null;

        return res.json() as Promise<{ posts: Post[]; hasMore: boolean }>;
      } catch {
        return null;
      }
    },
    [authorId, pageSize],
  );

  useEffect(() => {
    if (disabled) return;
    let mounted = true;

    fetchPosts().then((data) => {
      if (!mounted || !data) {
        if (mounted) startTransition(() => setLoading(false));
        return;
      }
      startTransition(() => {
        setPosts(data.posts);
        setHasMore(data.hasMore);
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
    };
  }, [disabled, fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    if (!last) {
      setLoadingMore(false);
      return;
    }

    const data = await fetchPosts(last.id);
    if (data) {
      startTransition(() => {
        setPosts((prev) => [...prev, ...data.posts]);
        setHasMore(data.hasMore);
      });
    }
    setLoadingMore(false);
  }, [posts, loadingMore, hasMore, fetchPosts]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore().catch(() => {});
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, disabled]);

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
  };
}
