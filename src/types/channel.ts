import type { ChannelMemberRole } from "@/lib/channel-roles";

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

export interface ChannelMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: ChannelMemberRole;
}

export interface ChannelSettings {
  channel: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
  };
  members: ChannelMember[];
}
