export type MediaType = "image" | "video" | "youtube" | "file";

export interface PostMedia {
  url: string;
  type: MediaType;
  position: number;
}

export interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface Post {
  id: string;
  content: string | null;
  media: PostMedia[];
  isPublic: boolean;
  createdAt: string;
  author: PostAuthor;
}
