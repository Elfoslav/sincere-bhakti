import type { PostChannel } from "@/types/post";

export interface BlogPost {
  id: string;
  shortId: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  content: string | null;
  contentHtml: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  language: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  channel: PostChannel;
}
