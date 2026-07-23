import { NextRequest, NextResponse } from "next/server";
import { getAuthorableChannels } from "@/lib/services/channel";
import { getActiveIdentityCookie, setActiveIdentityCookie } from "@/lib/active-identity";
import { resolveActiveIdentityState } from "@/lib/identity";
import { updateActiveIdentitySchema } from "@/lib/validation";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { ERROR_NOT_FOUND } from "@/lib/error-messages";
import { HTTP_NOT_FOUND } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, RATE_LIMIT_PREFIX.readIdentity, RATE_LIMITS.readIdentity, { skipCsrf: true });
    if (auth.response) return auth.response;
    const session = auth.session;

    const identities = await getAuthorableChannels(session.user.id);
    const cookieChannelId = getActiveIdentityCookie(request);
    const identityState = resolveActiveIdentityState({
      userId: session.user.id,
      identities,
      preferredChannelId: cookieChannelId,
      fallbackChannelId: session.user.channelId ?? undefined,
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
    return serverError("GET /api/identity", error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updateIdentity, RATE_LIMITS.updateIdentity, { authErrorCode: "unauthorized", authErrorStatus: 401 });
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, updateActiveIdentitySchema, "PATCH /api/identity");
    if (parsed.response) return parsed.response;

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
    return serverError("PATCH /api/identity", error);
  }
}
