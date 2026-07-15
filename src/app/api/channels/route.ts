import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { normalizeName, createChannelSchema, isBrandNameBlocked } from "@/lib/validation";
import { createChannel, NameTakenError } from "@/lib/services/channel";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_SERVER_ERROR, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_CREATED, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.searchChannels, ip, RATE_LIMITS.searchChannels.limit, RATE_LIMITS.searchChannels.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      const session = await auth();
      const isOwner = session?.user?.id === userId;
      const channel = await prisma.channel.findFirst({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          slug: true,
          avatarUrl: true,
          createdAt: true,
          ownerId: true,
          _count: { select: { posts: isOwner ? true : { where: { isPublic: true } } } },
        },
      });

      if (!channel) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }

      const { _count, ...data } = channel;
      return NextResponse.json({ ...data, postCount: _count.posts });
    }

    const cursor = searchParams.get("cursor");
    const query = searchParams.get("q")?.trim();

    const normalizedQuery = query ? normalizeName(query) : "";

    const where = query
      ? { normalizedName: { contains: normalizedQuery, mode: "insensitive" as const } }
      : {};

    const channels = await prisma.channel.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        avatarUrl: true,
        createdAt: true,
        ownerId: true,
        _count: { select: { posts: { where: { isPublic: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const items = channels.map(({ _count, ...data }) => ({
      ...data,
      postCount: _count.posts,
    }));

    return NextResponse.json({
      items,
      nextCursor: channels.length === 20 ? channels[channels.length - 1].id : null,
    });
  } catch (error) {
    logServerError("GET /api/channels failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.createChannel, session.user.id, RATE_LIMITS.createChannel.limit, RATE_LIMITS.createChannel.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/channels", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { name } = parsed.data;

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const channel = await createChannel(session.user.id, name);

    return NextResponse.json(channel, { status: HTTP_CREATED });
  } catch (error) {
    if (error instanceof NameTakenError) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }
    if ((error as { code?: string })?.code === "P2002") {
      logServerError("POST /api/channels P2002 collision", error);
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }
    logServerError("POST /api/channels failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}