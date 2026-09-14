import { getPathLocale } from "@/lib/locale-choice";

describe("getPathLocale", () => {
  it("returns the locale for prefixed paths", () => {
    expect(getPathLocale("/sk")).toBe("sk");
    expect(getPathLocale("/sk/")).toBe("sk");
    expect(getPathLocale("/sk/login")).toBe("sk");
    expect(getPathLocale("/cs/channels")).toBe("cs");
  });

  it("returns null for unprefixed paths", () => {
    expect(getPathLocale("/")).toBeNull();
    expect(getPathLocale("/login")).toBeNull();
    expect(getPathLocale("/channels/devotees")).toBeNull();
  });

  it("does not match lookalike prefixes", () => {
    expect(getPathLocale("/skate")).toBeNull();
    expect(getPathLocale("/css")).toBeNull();
  });
});
