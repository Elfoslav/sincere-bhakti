export const CHANNEL_ROLE_OWNER = "owner";
export const CHANNEL_ROLE_ADMIN = "admin";
export const CHANNEL_ROLE_EDITOR = "editor";

export const CHANNEL_ROLES = [
  CHANNEL_ROLE_OWNER,
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
] as const;

export const CHANNEL_MEMBER_ROLES = [
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
] as const;

export const CHANNEL_AUTHOR_ROLES = [
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
] as const;

export const CHANNEL_MEMBER_ACTION_ADD = "add";
export const CHANNEL_MEMBER_ACTION_EDIT = "edit";

export const CHANNEL_MEMBER_ACTIONS = [
  CHANNEL_MEMBER_ACTION_ADD,
  CHANNEL_MEMBER_ACTION_EDIT,
] as const;

export type ChannelRole = typeof CHANNEL_ROLES[number];
export type ChannelMemberRole = typeof CHANNEL_MEMBER_ROLES[number];
export type ChannelMemberAction = typeof CHANNEL_MEMBER_ACTIONS[number];

export function isChannelMemberRole(value: string): value is ChannelMemberRole {
  return (CHANNEL_MEMBER_ROLES as readonly string[]).includes(value);
}
