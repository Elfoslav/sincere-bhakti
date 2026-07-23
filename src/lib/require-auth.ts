import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";

type SessionUser = { user: { id: string; email?: string | null; name?: string | null; image?: string | null; channelId?: string | null } };

type AuthResult = { session: SessionUser; response?: undefined } | { session?: undefined; response: NextResponse };

export async function requireAuth(
  request: NextRequest,
  rateLimitPrefix: string,
  rateLimit: { limit: number; windowMs: number },
  opts?: {
    rateLimitIdentifier?: string;
    authErrorCode?: string;
    authErrorStatus?: number;
    skipCsrf?: boolean;
    skipRateLimit?: boolean;
  },
): Promise<AuthResult> {
  if (!opts?.skipCsrf && !validateOrigin(request)) {
    return { response: NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN }) };
  }

  const session = await auth();
  if (!session?.user?.id) {
    const code = opts?.authErrorCode ?? ERROR_FORBIDDEN;
    const status = opts?.authErrorStatus ?? HTTP_FORBIDDEN;
    return { response: NextResponse.json({ error: code }, { status }) };
  }

  if (!opts?.skipRateLimit) {
    const id = opts?.rateLimitIdentifier ?? session.user.id;
    if (!await checkRateLimit(rateLimitPrefix, id, rateLimit.limit, rateLimit.windowMs)) {
      return { response: NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS }) };
    }
  }

  return { session: session as SessionUser };
}
