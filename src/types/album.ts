import type { PostChannel } from "@/types/post";

export type AlbumMediaType = "image" | "video" | "youtube" | "file";

export interface AlbumItem {
  url: string;
  type: AlbumMediaType;
  position: number;
  width: number | null;
  height: number | null;
}

export interface Album {
  id: string;
  shortId: string;
  slug: string | null;
  title: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  isPublic: boolean;
  language: string;
  createdAt: string;
  updatedAt: string;
  channel: PostChannel;
  items: AlbumItem[];
}
