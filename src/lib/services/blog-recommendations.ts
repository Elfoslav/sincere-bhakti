import { getBlogPosts, type BlogPostResponse } from "@/lib/services/blog";
import { LATEST_BLOG_POSTS_LIMIT } from "@/lib/blog";
import type { BlogRecommendations } from "@/types/blog";

/** Independent, bounded public queries: one unavailable group never hides the article. */
export async function getBlogRecommendations(
  post: Pick<BlogPostResponse, "id" | "channel">,
  language: string,
): Promise<BlogRecommendations<BlogPostResponse>> {
  const shared = {
    scope: "public" as const,
    language,
    requestLanguage: language,
    excludePostId: post.id,
    limit: LATEST_BLOG_POSTS_LIMIT,
    includeContentHtml: false,
  };
  const [channel, others] = await Promise.allSettled([
    getBlogPosts({ ...shared, channelId: post.channel.id }),
    getBlogPosts({ ...shared, excludeChannelId: post.channel.id }),
  ]);
  return {
    channelPosts: channel.status === "fulfilled" ? channel.value.posts : [],
    otherPosts: others.status === "fulfilled" ? others.value.posts : [],
  };
}
