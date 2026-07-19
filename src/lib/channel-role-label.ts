import {
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
  type ChannelMemberRole,
} from "@/lib/channel-roles";

export const CHANNEL_ROLE_LABEL_KEYS = {
  [CHANNEL_ROLE_ADMIN]: "roleAdmin",
  [CHANNEL_ROLE_EDITOR]: "roleEditor",
} as const satisfies Record<ChannelMemberRole, string>;

export type ChannelRoleLabelKey = typeof CHANNEL_ROLE_LABEL_KEYS[ChannelMemberRole];

export function channelRoleLabelKey(role: ChannelMemberRole): ChannelRoleLabelKey {
  return CHANNEL_ROLE_LABEL_KEYS[role];
}
