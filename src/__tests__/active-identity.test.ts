import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  ACTIVE_IDENTITY_COOKIE,
  getActiveIdentityCookie,
  setActiveIdentityCookie,
} from "@/lib/active-identity";

describe("active identity cookie helpers", () => {
  it("reads active channel id from request cookies", () => {
    const request = {
      cookies: {
        get: (name: string) => name === ACTIVE_IDENTITY_COOKIE ? { value: "channel-1" } : undefined,
      },
    } as any;

    expect(getActiveIdentityCookie(request)).toBe("channel-1");
  });

  it("sets an http-only active identity cookie", () => {
    const response = NextResponse.json({});

    setActiveIdentityCookie(response, "channel-2");

    expect(response.headers.get("set-cookie")).toContain(`${ACTIVE_IDENTITY_COOKIE}=channel-2`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });
});
