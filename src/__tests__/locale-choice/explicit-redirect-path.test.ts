import { explicitRedirectPath } from "@/lib/locale-choice";

describe("explicitRedirectPath", () => {
  it("prefixes unprefixed paths with a non-default explicit locale", () => {
    expect(explicitRedirectPath("/", "sk")).toBe("/sk");
    expect(explicitRedirectPath("/login", "sk")).toBe("/sk/login");
    expect(explicitRedirectPath("/channels", "cs")).toBe("/cs/channels");
  });

  it("returns null when the explicit locale is the default (prefix-less) locale", () => {
    expect(explicitRedirectPath("/", "en")).toBeNull();
    expect(explicitRedirectPath("/login", "en")).toBeNull();
  });

  it("returns null when the URL already carries a locale prefix", () => {
    expect(explicitRedirectPath("/sk", "sk")).toBeNull();
    expect(explicitRedirectPath("/sk/login", "en")).toBeNull();
    expect(explicitRedirectPath("/cs/channels", "sk")).toBeNull();
  });
});
