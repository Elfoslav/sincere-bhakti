import type { PostChannel } from "@/types/post";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  channel?: PostChannel | null;
}
