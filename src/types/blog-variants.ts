import type { BlogPost } from "@/types/blog";

/**
 * Props shared by every blog-detail design variant in the preview gallery.
 * Variants are purely presentational: no session, no edit wiring.
 */
export interface BlogDetailVariantProps {
  post: BlogPost;
  contentHtml: string;
  latestPosts: BlogPost[];
}
