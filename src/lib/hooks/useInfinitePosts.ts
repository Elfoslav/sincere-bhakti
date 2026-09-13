import type { Post } from "@/types/post";
import { useInfiniteFeed } from "@/lib/hooks/useInfiniteFeed";

type ApiParams = {
  scope?: "public" | "private";
  channelId?: string;
  disabled?: boolean;
  pageSize?: number;
  language?: string;
  category?: string;
  // Server-rendered first page. When provided, the hook seeds state from it and
  // skips the initial client fetch — removing the hydrate→fetch→render waterfall.
  initialData?: { posts: Post[]; hasMore: boolean };
};

export function useInfinitePosts(params?: ApiParams) {
  return useInfiniteFeed<Post>("/api/posts", params);
}
