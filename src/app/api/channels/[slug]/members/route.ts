import { NextRequest, NextResponse } from "next/server";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "@/lib/error-codes";
import {
  ERROR_CANNOT_ADD_CHANNEL_OWNER,
  ERROR_CHANNEL_MEMBER_CONFLICT,
  ERROR_CHANNEL_MEMBER_EXISTS,
  ERROR_NOT_FOUND,
  ERROR_USER_NOT_FOUND,
} from "@/lib/error-messages";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { CHANNEL_MEMBER_ACTION_ADD } from "@/lib/channel-roles";
import { parseBody } from "@/lib/parse-body";
import { addChannelMemberSchema } from "@/lib/validation";
import {
  addChannelMemberByEmail,
  ChannelMemberAlreadyExistsError,
  ChannelMemberTransactionConflictError,
  CannotAddChannelOwnerError,
  getChannelSettingsBySlug,
  NotFoundError,
  updateChannelMemberByEmail,
  UserNotFoundError,
} from "@/lib/services/channel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.readChannelMembers, RATE_LIMITS.readChannelMembers, { skipCsrf: true });
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const { slug } = await params;
    const settings = await getChannelSettingsBySlug(slug, session.user.id);
    if (!settings) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    return NextResponse.json({ members: settings.members });
  } catch (error) {
    return serverError("GET /api/channels/[slug]/members", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updateChannelMembers, RATE_LIMITS.updateChannelMembers);
  if (auth.response) return auth.response;
  const session = auth.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "validation_error:body:invalid_type" }, { status: HTTP_BAD_REQUEST });
  }

  const parsed = parseBody(body, addChannelMemberSchema, "POST /api/channels/[slug]/members");
  if (parsed.response) return parsed.response;

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
    if (error instanceof ChannelMemberTransactionConflictError) {
      return NextResponse.json({ error: ERROR_CHANNEL_MEMBER_CONFLICT }, { status: HTTP_CONFLICT });
    }

    return serverError("POST /api/channels/[slug]/members", error);
  }
}
