export interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  postCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  channels: ChannelInfo[];
}
