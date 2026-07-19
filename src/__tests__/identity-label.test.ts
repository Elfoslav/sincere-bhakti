import { describe, expect, it } from "vitest";
import {
  CHANNEL_ROLE_ADMIN,
  CHANNEL_ROLE_EDITOR,
  CHANNEL_ROLE_OWNER,
} from "@/lib/channel-roles";
import { getIdentitySubtitleKey } from "@/lib/identity-label";

describe("getIdentitySubtitleKey", () => {
  it("labels the user's own personal channel as personal", () => {
    expect(getIdentitySubtitleKey({ isPersonal: true, role: CHANNEL_ROLE_OWNER })).toBe("personal");
  });

  it("labels delegated personal channels by the user's role", () => {
    expect(getIdentitySubtitleKey({ isPersonal: true, role: CHANNEL_ROLE_ADMIN })).toBe(CHANNEL_ROLE_ADMIN);
    expect(getIdentitySubtitleKey({ isPersonal: true, role: CHANNEL_ROLE_EDITOR })).toBe(CHANNEL_ROLE_EDITOR);
  });

  it("labels non-personal channels by role", () => {
    expect(getIdentitySubtitleKey({ isPersonal: false, role: CHANNEL_ROLE_OWNER })).toBe(CHANNEL_ROLE_OWNER);
    expect(getIdentitySubtitleKey({ isPersonal: false, role: CHANNEL_ROLE_ADMIN })).toBe(CHANNEL_ROLE_ADMIN);
  });
});
