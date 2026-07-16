import type { AuthorableIdentity, InitialIdentityState } from "@/types/identity";

export function resolveActiveIdentityState({
  userId,
  identities,
  preferredChannelId,
  fallbackChannelId,
}: {
  userId: string;
  identities: AuthorableIdentity[];
  preferredChannelId?: string;
  fallbackChannelId?: string;
}): InitialIdentityState {
  const activeIdentity = identities.find((identity) => identity.id === preferredChannelId)
    ?? identities.find((identity) => identity.id === fallbackChannelId)
    ?? identities[0]
    ?? null;

  return {
    userId,
    activeChannelId: activeIdentity?.id ?? null,
    identities,
  };
}
