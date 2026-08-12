import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import type { Post } from "@/types/post";

const PAGE_SIZE = 10;

type ApiParams = {
  scope?: "public" | "private";
  channelId?: string;
  disabled?: boolean;
  pageSize?: number;
  language?: string;
  // Server-rendered first page. When provided, the hook seeds state from it and
  // skips the initial client fetch — removing the hydrate→fetch→render waterfall.
  initialData?: { posts: Post[]; hasMore: boolean };
};

export function useInfinitePosts(params?: ApiParams) {
  const { scope, channelId, disabled, pageSize = PAGE_SIZE, language, initialData } = params ?? {};
  const [posts, setPosts] = useState<Post[]>(initialData?.posts ?? []);
  const [loading, setLoading] = useState(!disabled && !initialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Guards loadMore against concurrent invocations. State-based guards are
  // unreliable here: the IntersectionObserver can fire twice before React
  // re-renders, so both calls would read loadingMore === false and append the
  // same cursor page, producing duplicate post ids (React duplicate-key error).
  const loadingMoreRef = useRef(false);
  // True until the first fetch effect runs once; lets us skip the initial fetch
  // when server-provided initialData already populated state.
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

        const res = await fetch(`/api/posts?${query}`);
        if (!res.ok) return null;

        return res.json() as Promise<{ posts: Post[]; hasMore: boolean }>;
      } catch {
        return null;
      }
    },
    [scope, channelId, pageSize, language],
  );

  useEffect(() => {
    if (disabled) return;
    // First run with server-provided data already in state: don't refetch.
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
        // Dedupe by id: an earlier double-fire of the observer could have
        // already appended this page, and a create/update could race the fetch.
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
  }, [posts, loadingMoreRef, hasMore, fetchPosts]);

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
