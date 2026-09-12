import type { BlogPost } from "@/types/blog";
import type { CategoryRef } from "@/types/category";

export type MediaType = "image" | "video" | "youtube" | "file";
export interface PostMedia {
  url: string;
  type: MediaType;
  position: number;
  width: number | null;
  height: number | null;
}

export interface PostChannel {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
}

export interface Post {
  id: string;
  shortId: string;
  slug: string | null;
  content: string | null;
  media: PostMedia[];
  isPublic: boolean;
  language: string;
  // Null = visible immediately; a future date hides the post from public
  // feeds until then (timeline promos of scheduled articles).
  publishedAt: string | null;
  createdAt: string;
  channel: PostChannel;
  blogPost: BlogPost | null;
  categories: CategoryRef[];
}
