import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import type { BlogPost } from "@/types/blog";

const PAGE_SIZE = 10;

type ApiParams = {
  scope?: "public" | "private";
  channelId?: string;
  disabled?: boolean;
  pageSize?: number;
  language?: string;
  initialData?: { posts: BlogPost[]; hasMore: boolean };
};

export function useInfiniteBlogPosts(params?: ApiParams) {
  const { scope, channelId, disabled, pageSize = PAGE_SIZE, language, initialData } = params ?? {};
  const [posts, setPosts] = useState<BlogPost[]>(initialData?.posts ?? []);
  const [loading, setLoading] = useState(!disabled && !initialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingMoreRef = useRef(false);
  const skipInitialFetch = useRef(Boolean(initialData));

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      try {
        const query = new URLSearchParams();
        if (scope) query.set("scope", scope);
        query.set("limit", String(pageSize));
        if (cursor) query.set("cursor", cursor);
        if (channelId) query.set("channelId", channelId);
        if (language) query.set("language", language);

        const res = await fetch(`/api/blog-posts?${query}`);
        if (!res.ok) return null;

        return res.json() as Promise<{ posts: BlogPost[]; hasMore: boolean }>;
      } catch {
        return null;
      }
    },
    [scope, channelId, pageSize, language],
  );

  useEffect(() => {
    if (disabled) return;
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    let mounted = true;

    setLoading(true);
    setPosts([]);
    setHasMore(true);

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
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    if (!last) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    const data = await fetchPosts(last.id);
    if (data) {
      startTransition(() => {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = data.posts.filter((p) => !seen.has(p.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        setHasMore(data.hasMore);
      });
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [posts, hasMore, fetchPosts]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (node && !disabled) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) loadMore().catch(() => {});
          },
          { rootMargin: "200px" },
        );
        observerRef.current.observe(node);
      }
    },
    [loadMore, disabled],
  );

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
  };
}
