import type { BlogPost } from "@/types/blog";
import { useInfiniteFeed } from "@/lib/hooks/useInfiniteFeed";

type ApiParams = {
  scope?: "public" | "private";
  channelId?: string;
  disabled?: boolean;
  pageSize?: number;
  language?: string;
  category?: string;
  initialData?: { posts: BlogPost[]; hasMore: boolean };
};

export function useInfiniteBlogPosts(params?: ApiParams) {
  return useInfiniteFeed<BlogPost>("/api/blog-posts", params);
}
