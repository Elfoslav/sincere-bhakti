import { describe, expect, it } from "vitest";
import { CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import { channelRoleLabelKey } from "@/lib/channel-role-label";

describe("channelRoleLabelKey", () => {
  it("returns the shared translation key for admin", () => {
    expect(channelRoleLabelKey(CHANNEL_ROLE_ADMIN)).toBe("roleAdmin");
  });

  it("returns the shared translation key for editor", () => {
    expect(channelRoleLabelKey(CHANNEL_ROLE_EDITOR)).toBe("roleEditor");
  });
});
