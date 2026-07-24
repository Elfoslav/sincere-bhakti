import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import type { SessionUser } from "@/types/auth";

type NonAuthOptions = {
  rateLimitIdentifier?: string;
  authErrorCode?: string;
  authErrorStatus?: number;
  skipCsrf?: boolean;
  skipRateLimit?: boolean;
};

type AuthResult =
  | { session: SessionUser; response: undefined }
  | { session: undefined; response: NextResponse };

export async function requireAuth(
  request: NextRequest,
  rateLimitPrefix: string,
  rateLimit: { limit: number; windowMs: number },
  opts?: NonAuthOptions & { skipAuth?: false },
): Promise<AuthResult>;
export async function requireAuth(
  request: NextRequest,
  rateLimitPrefix: string,
  rateLimit: { limit: number; windowMs: number },
  opts: NonAuthOptions & { skipAuth: true },
): Promise<{ session: undefined; response: NextResponse | undefined }>;
export async function requireAuth(
  request: NextRequest,
  rateLimitPrefix: string,
  rateLimit: { limit: number; windowMs: number },
  opts?: NonAuthOptions & { skipAuth?: boolean },
): Promise<AuthResult | { session: undefined; response: NextResponse | undefined }> {
  if (!opts?.skipCsrf && !validateOrigin(request)) {
    return { session: undefined, response: NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN }) };
  }

  let session: SessionUser | undefined;
  if (!opts?.skipAuth) {
    const s = await auth();
    if (!s?.user?.id) {
      const code = opts?.authErrorCode ?? ERROR_FORBIDDEN;
      const status = opts?.authErrorStatus ?? HTTP_FORBIDDEN;
      return { session: undefined, response: NextResponse.json({ error: code }, { status }) };
    }
    session = s as SessionUser;
  }

  if (!opts?.skipRateLimit) {
    const id = opts?.rateLimitIdentifier ?? session?.user?.id ?? getClientIp(request.headers);
    if (!await checkRateLimit(rateLimitPrefix, id, rateLimit.limit, rateLimit.windowMs)) {
      return { session: undefined, response: NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS }) };
    }
  }

  if (opts?.skipAuth) return { session: undefined, response: undefined };
  return { session: session!, response: undefined };
}
