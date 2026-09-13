import type { BlogPost } from "@/types/blog";
import { useInfiniteFeed, type FeedParams } from "@/lib/hooks/useInfiniteFeed";

type ApiParams = FeedParams<BlogPost>;

export function useInfiniteBlogPosts(params?: ApiParams) {
  return useInfiniteFeed<BlogPost>("/api/blog-posts", params);
}
