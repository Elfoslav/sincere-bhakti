import { AUTHENTICATED, isAuthenticated } from "@/lib/session";

describe("AUTHENTICATED", () => {
  it("is the string 'authenticated'", () => {
    expect(AUTHENTICATED).toBe("authenticated");
  });
});

describe("isAuthenticated", () => {
  it("returns true when status is 'authenticated'", () => {
    expect(isAuthenticated("authenticated")).toBe(true);
  });

  it("returns false when status is 'loading'", () => {
    expect(isAuthenticated("loading")).toBe(false);
  });

  it("returns false when status is 'unauthenticated'", () => {
    expect(isAuthenticated("unauthenticated")).toBe(false);
  });
});
