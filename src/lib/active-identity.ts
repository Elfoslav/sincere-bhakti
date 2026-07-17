import type { NextRequest, NextResponse } from "next/server";

export const ACTIVE_IDENTITY_COOKIE = "sb_active_channel_id";
export const ACTIVE_IDENTITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function getActiveIdentityCookie(request: NextRequest): string | undefined {
  return request.cookies?.get(ACTIVE_IDENTITY_COOKIE)?.value || undefined;
}

export function setActiveIdentityCookie(response: NextResponse, channelId: string): void {
  response.cookies.set(ACTIVE_IDENTITY_COOKIE, channelId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_IDENTITY_COOKIE_MAX_AGE,
  });
}
