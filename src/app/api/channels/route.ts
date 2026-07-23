import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { requireAuth } from "@/lib/require-auth";
import { handlePrismaCollision, serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";
import { normalizeName, createChannelSchema, isBrandNameBlocked } from "@/lib/validation";
import { createChannel, NameTakenError, ChannelLimitError } from "@/lib/services/channel";
import { ERROR_NOT_FOUND, ERROR_CHANNEL_LIMIT_REACHED, ERROR_NAME_TAKEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_CONFLICT, HTTP_CREATED, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.searchChannels, ip, RATE_LIMITS.searchChannels.limit, RATE_LIMITS.searchChannels.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const language = searchParams.get("language") ?? "en";

    if (userId) {
      const session = await auth();
      const isOwner = session?.user?.id === userId;
      const channel = await prisma.channel.findFirst({
        where: { ownerId: userId },
        select: {
          id: true,
          avatarUrl: true,
          createdAt: true,
          ownerId: true,
          _count: { select: { posts: isOwner ? true : { where: { isPublic: true } } } },
          translations: { where: { language }, select: { name: true, slug: true }, take: 1 },
        },
      });

      if (!channel) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }

      const { _count, translations, ...data } = channel;
      const t = translations[0] ?? { name: "", slug: "" };
      return NextResponse.json({ ...data, name: t.name, slug: t.slug, postCount: _count.posts });
    }

    const cursor = searchParams.get("cursor");
    const query = searchParams.get("q")?.trim();

    const normalizedQuery = query ? normalizeName(query) : "";

    const channelIds = query
      ? await prisma.channelTranslation.findMany({
          where: { language, normalizedName: { contains: normalizedQuery, mode: "insensitive" as const } },
          select: { channelId: true },
          distinct: ["channelId"],
          take: 20,
        }).then((rows) => rows.map((r) => r.channelId))
      : undefined;

    const channelFilter = channelIds ? { id: { in: channelIds } } : {};
    const where = { ...channelFilter, translations: { some: { language } } };

    const channels = await prisma.channel.findMany({
      where,
      select: {
        id: true,
        avatarUrl: true,
        createdAt: true,
        ownerId: true,
        _count: { select: { posts: { where: { isPublic: true } } } },
        translations: { where: { language }, select: { name: true, slug: true }, take: 1 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const items = channels.map(({ _count, translations, ...data }) => {
      const t = translations[0] ?? { name: "", slug: "" };
      return { ...data, name: t.name, slug: t.slug, postCount: _count.posts };
    });

    return NextResponse.json({
      items,
      nextCursor: channels.length === 20 ? channels[channels.length - 1].id : null,
    });
  } catch (error) {
    return serverError("GET /api/channels", error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.createChannel, RATE_LIMITS.createChannel);
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, createChannelSchema, "POST /api/channels");
    if (parsed.response) return parsed.response;

    const { name, language } = parsed.data;

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    const channel = await createChannel(session.user.id, name, language);

    return NextResponse.json(channel, { status: HTTP_CREATED });
  } catch (error) {
    if (error instanceof ChannelLimitError) {
      return NextResponse.json({ error: ERROR_CHANNEL_LIMIT_REACHED }, { status: HTTP_CONFLICT });
    }
    if (error instanceof NameTakenError) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    const collision = handlePrismaCollision(error, "POST /api/channels");
    if (collision) return collision;
    return serverError("POST /api/channels", error);
  }
}
