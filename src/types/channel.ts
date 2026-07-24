import type { ChannelMemberRole } from "@/lib/channel-roles";

export interface ChannelTranslationInfo {
  id: string;
  language: string;
  name: string;
  normalizedName: string;
  slug: string;
}

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
  defaultLanguage: string;
  availableLanguages: string[];
}

export interface ChannelMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: ChannelMemberRole;
}

export interface ChannelSettingsTranslation {
  id: string;
  language: string;
  name: string;
  slug: string;
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
    isPersonal: boolean;
    renameCount: number;
  };
  members: ChannelMember[];
  translations: ChannelSettingsTranslation[];
}
