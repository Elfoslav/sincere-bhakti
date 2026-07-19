import {
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
  type ChannelMemberRole,
} from "@/lib/channel-roles";
import {
  ERROR_CANNOT_ADD_CHANNEL_OWNER,
  ERROR_CHANNEL_MEMBER_CONFLICT,
  ERROR_CHANNEL_MEMBER_EXISTS,
  ERROR_TOO_MANY_REQUESTS,
  ERROR_USER_NOT_FOUND,
} from "@/lib/error-messages";

type ChannelSettingsTranslation = (key: string) => string;

export function channelMemberRoleLabel(role: ChannelMemberRole, t: ChannelSettingsTranslation) {
  if (role === CHANNEL_ROLE_ADMIN) return t("roleAdmin");
  if (role === CHANNEL_ROLE_EDITOR) return t("roleEditor");
  return role;
}

export function channelMemberErrorMessage(code: string | undefined, t: ChannelSettingsTranslation) {
  if (code === ERROR_USER_NOT_FOUND) return t("userNotFound");
  if (code === ERROR_CANNOT_ADD_CHANNEL_OWNER) return t("cannotAddOwner");
  if (code === ERROR_CHANNEL_MEMBER_EXISTS) return t("memberAlreadyExists");
  if (code === ERROR_CHANNEL_MEMBER_CONFLICT) return t("memberConflict");
  if (code === ERROR_TOO_MANY_REQUESTS) return t("tooManyRequests");
  if (code?.startsWith("validation_error")) return t("validationError");
  return t("saveError");
}
