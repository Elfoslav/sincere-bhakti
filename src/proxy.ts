import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleI18n = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const normalized = pathname.replace(/^\/(sk|cs)(\/|$)/, "/");
  const isAuthPage =
    normalized === "/login" || normalized === "/register";

  if (isAuthPage) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (token) {
      const localeMatch = pathname.match(/^\/(sk|cs)/);
      return NextResponse.redirect(
        new URL(localeMatch?.[1] ? `/${localeMatch[1]}` : "/", req.url),
      );
    }
  }

  return handleI18n(req);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
