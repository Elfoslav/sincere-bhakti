import { parseExplicitLocale } from "@/lib/locale-choice";

describe("parseExplicitLocale", () => {
  it("returns the locale for a valid cookie value", () => {
    expect(parseExplicitLocale("sk")).toBe("sk");
    expect(parseExplicitLocale("cs")).toBe("cs");
    expect(parseExplicitLocale("en")).toBe("en");
  });

  it("returns null for unknown locales", () => {
    expect(parseExplicitLocale("de")).toBeNull();
    expect(parseExplicitLocale("SK")).toBeNull();
    expect(parseExplicitLocale("")).toBeNull();
  });

  it("returns null for missing or non-string values", () => {
    expect(parseExplicitLocale(undefined)).toBeNull();
    expect(parseExplicitLocale(null)).toBeNull();
    expect(parseExplicitLocale(42)).toBeNull();
  });
});
