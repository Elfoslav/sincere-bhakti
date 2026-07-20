import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthorableChannels } from "@/lib/services/channel";
import { getActiveIdentityCookie, setActiveIdentityCookie } from "@/lib/active-identity";
import { resolveActiveIdentityState } from "@/lib/identity";
import { updateActiveIdentitySchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_UNAUTHORIZED, ERROR_NOT_FOUND, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readIdentity, session.user.id, RATE_LIMITS.readIdentity.limit, RATE_LIMITS.readIdentity.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const identities = await getAuthorableChannels(session.user.id);
    const cookieChannelId = getActiveIdentityCookie(request);
    const identityState = resolveActiveIdentityState({
      userId: session.user.id,
      identities,
      preferredChannelId: cookieChannelId,
      fallbackChannelId: session.user.channelId,
    });

    const response = NextResponse.json({
      activeChannelId: identityState.activeChannelId,
      identities,
    });
    if (identityState.activeChannelId && identityState.activeChannelId !== cookieChannelId) {
      setActiveIdentityCookie(response, identityState.activeChannelId);
    }
    return response;
  } catch (error) {
    logServerError("GET /api/identity failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateIdentity, session.user.id, RATE_LIMITS.updateIdentity.limit, RATE_LIMITS.updateIdentity.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = updateActiveIdentitySchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("PATCH /api/identity", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const identities = await getAuthorableChannels(session.user.id);
    const activeIdentity = identities.find((identity) => identity.id === parsed.data.channelId);
    if (!activeIdentity) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const response = NextResponse.json({
      activeChannelId: activeIdentity.id,
      identities,
    });
    setActiveIdentityCookie(response, activeIdentity.id);
    return response;
  } catch (error) {
    logServerError("PATCH /api/identity failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
