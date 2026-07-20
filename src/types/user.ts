import type { ChannelMemberRole } from "@/lib/channel-roles";

export interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  postCount: number;
  isPersonal: boolean;
}

export interface ManagedChannelInfo extends ChannelInfo {
  role: ChannelMemberRole;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  renameCount: number;
  additionalChannelCount: number;
  channelLimit: number;
  channels: ChannelInfo[];
  managedChannels: ManagedChannelInfo[];
}
