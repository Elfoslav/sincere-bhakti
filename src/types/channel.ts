export interface ChannelWithPostCount {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  postCount: number;
  isPersonal: boolean;
  renameCount: number;
}
