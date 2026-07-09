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
  content: string | null;
  media: PostMedia[];
  isPublic: boolean;
  createdAt: string;
  channel: PostChannel;
}
