import { CHANNEL_ROLE_OWNER, type ChannelRole } from "@/lib/channel-roles";
import type { AuthorableIdentity } from "@/types/identity";

export type IdentitySubtitleKey = "personal" | ChannelRole;

export function getIdentitySubtitleKey(identity: Pick<AuthorableIdentity, "isPersonal" | "role">): IdentitySubtitleKey {
  if (identity.isPersonal && identity.role === CHANNEL_ROLE_OWNER) return "personal";
  return identity.role;
}
