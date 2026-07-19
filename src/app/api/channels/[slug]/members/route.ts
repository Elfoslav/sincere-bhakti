import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import {
  ERROR_CANNOT_ADD_CHANNEL_OWNER,
  ERROR_CHANNEL_MEMBER_EXISTS,
  ERROR_FORBIDDEN,
  ERROR_NOT_FOUND,
  ERROR_SERVER_ERROR,
  ERROR_TOO_MANY_REQUESTS,
  ERROR_USER_NOT_FOUND,
} from "@/lib/error-messages";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { CHANNEL_MEMBER_ACTION_ADD } from "@/lib/channel-roles";
import { logServerError, logValidationError } from "@/lib/server-log";
import { addChannelMemberSchema } from "@/lib/validation";
import {
  addChannelMemberByEmail,
  ChannelMemberAlreadyExistsError,
  CannotAddChannelOwnerError,
  getChannelSettingsBySlug,
  NotFoundError,
  updateChannelMemberByEmail,
  UserNotFoundError,
} from "@/lib/services/channel";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannelMembers, session.user.id, RATE_LIMITS.readChannelMembers.limit, RATE_LIMITS.readChannelMembers.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const { slug } = await params;
    const settings = await getChannelSettingsBySlug(slug, session.user.id);
    if (!settings) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    return NextResponse.json({ members: settings.members });
  } catch (error) {
    logServerError("GET /api/channels/[slug]/members failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateChannelMembers, session.user.id, RATE_LIMITS.updateChannelMembers.limit, RATE_LIMITS.updateChannelMembers.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "validation_error:body:invalid_type" }, { status: HTTP_BAD_REQUEST });
  }

  const parsed = addChannelMemberSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    logValidationError("POST /api/channels/[slug]/members", issue, body);
    return NextResponse.json(
      { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
      { status: HTTP_BAD_REQUEST },
    );
  }

  try {
    const { slug } = await params;
    const settings = await getChannelSettingsBySlug(slug, session.user.id);
    if (!settings) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const mutateMember = parsed.data.action === CHANNEL_MEMBER_ACTION_ADD
      ? addChannelMemberByEmail
      : updateChannelMemberByEmail;

    const member = await mutateMember({
      channelId: settings.channel.id,
      email: parsed.data.email,
      role: parsed.data.role,
      actorUserId: session.user.id,
    });

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: ERROR_USER_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof CannotAddChannelOwnerError) {
      return NextResponse.json({ error: ERROR_CANNOT_ADD_CHANNEL_OWNER }, { status: HTTP_BAD_REQUEST });
    }
    if (error instanceof ChannelMemberAlreadyExistsError) {
      return NextResponse.json({ error: ERROR_CHANNEL_MEMBER_EXISTS }, { status: HTTP_CONFLICT });
    }

    logServerError("POST /api/channels/[slug]/members failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
