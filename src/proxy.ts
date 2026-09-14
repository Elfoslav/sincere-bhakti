import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  EXPLICIT_LOCALE_COOKIE,
  explicitRedirectPath,
  parseExplicitLocale,
} from "@/lib/locale-choice";

const handleI18n = createMiddleware(routing);
// Detection-disabled instance for visitors who already picked a language:
// the explicit choice (or the default) decides, never Accept-Language.
const handleI18nNoDetection = createMiddleware({ ...routing, localeDetection: false });

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const normalized = pathname.replace(/^\/(sk|cs)(\/|$)/, "/");
  const isAuthPage =
    normalized === "/login" || normalized === "/register";

  if (isAuthPage) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET });

    if (token) {
      const localeMatch = pathname.match(/^\/(sk|cs)/);
      return NextResponse.redirect(
        new URL(localeMatch?.[1] ? `/${localeMatch[1]}` : "/", req.url),
      );
    }
  }

  // An explicit switcher pick freezes locale resolution: Accept-Language is
  // only consulted on the first (choice-less) load. Only the switcher writes
  // this cookie — auto-detected visits never do.
  const explicit = parseExplicitLocale(req.cookies.get(EXPLICIT_LOCALE_COOKIE)?.value);
  if (explicit) {
    const redirectPath = explicitRedirectPath(pathname, explicit);
    if (redirectPath) {
      const url = req.nextUrl.clone();
      url.pathname = redirectPath;
      return NextResponse.redirect(url);
    }
    return handleI18nNoDetection(req);
  }

  return handleI18n(req);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
