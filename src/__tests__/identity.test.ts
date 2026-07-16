import { describe, expect, it } from "vitest";
import { resolveActiveIdentityState } from "@/lib/identity";
import type { AuthorableIdentity } from "@/types/identity";

const identities: AuthorableIdentity[] = [
  {
    id: "channel-1",
    name: "Personal",
    slug: "personal",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: true,
    role: "owner",
  },
  {
    id: "channel-2",
    name: "Kirtan",
    slug: "kirtan",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: false,
    role: "owner",
  },
];

describe("resolveActiveIdentityState", () => {
  it("prefers a valid cookie identity", () => {
    expect(resolveActiveIdentityState({
      userId: "user-1",
      identities,
      preferredChannelId: "channel-2",
      fallbackChannelId: "channel-1",
    }).activeChannelId).toBe("channel-2");
  });

  it("falls back to session channel and then first identity", () => {
    expect(resolveActiveIdentityState({
      userId: "user-1",
      identities,
      preferredChannelId: "missing",
      fallbackChannelId: "channel-1",
    }).activeChannelId).toBe("channel-1");

    expect(resolveActiveIdentityState({
      userId: "user-1",
      identities,
      preferredChannelId: "missing",
      fallbackChannelId: "also-missing",
    }).activeChannelId).toBe("channel-1");
  });

  it("returns null active channel when user has no identities", () => {
    expect(resolveActiveIdentityState({
      userId: "user-1",
      identities: [],
    })).toEqual({
      userId: "user-1",
      activeChannelId: null,
      identities: [],
    });
  });
});
