import type { Post } from "@/types/post";
import { useInfiniteFeed, type FeedParams } from "@/lib/hooks/useInfiniteFeed";

type ApiParams = FeedParams<Post>;

export function useInfinitePosts(params?: ApiParams) {
  return useInfiniteFeed<Post>("/api/posts", params);
}
