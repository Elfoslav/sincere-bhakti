import type { ChannelRole } from "@/lib/channel-roles";

export type IdentityRole = ChannelRole;

export interface AuthorableIdentity {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  isPersonal: boolean;
  role: IdentityRole;
}

export interface InitialIdentityState {
  userId: string;
  activeChannelId: string | null;
  identities: AuthorableIdentity[];
}
