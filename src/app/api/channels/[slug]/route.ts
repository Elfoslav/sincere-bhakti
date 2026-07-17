import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getChannelBySlug, isNormalizedNameTaken } from "@/lib/services/channel";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { createChannelSchema, normalizeName, isBrandNameBlocked, slugifyName, MAX_RENAME_COUNT } from "@/lib/validation";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_SERVER_ERROR, ERROR_TOO_MANY_REQUESTS, ERROR_RENAME_LIMIT } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannel, ip, RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
    const { slug } = await params;
    const channel = await getChannelBySlug(slug);

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    return NextResponse.json(channel);
  } catch (error) {
    logServerError("GET /api/channels/[slug] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const { slug } = await params;

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateChannel, session.user.id, RATE_LIMITS.updateChannel.limit, RATE_LIMITS.updateChannel.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { slug },
      select: { id: true, name: true, ownerId: true, isPersonal: true, slug: true, avatarUrl: true, renameCount: true },
    });

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (channel.ownerId !== session.user.id) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (channel.isPersonal) {
      return NextResponse.json({ error: "cannot_rename_personal_channel" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("PATCH /api/channels/[slug]", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { name } = parsed.data;

    const normalizedTarget = normalizeName(name);

    // Renaming to the same name is a no-op — don't count or write history
    if (normalizedTarget === normalizeName(channel.name)) {
      return NextResponse.json({
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        avatarUrl: channel.avatarUrl,
        ownerId: channel.ownerId,
        renameCount: channel.renameCount,
      });
    }

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    if (channel.renameCount >= MAX_RENAME_COUNT) {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }

    // Check if the new name is already taken by another channel
    if (await isNormalizedNameTaken(normalizedTarget, channel.id)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const newSlug = slugifyName(name);
    const oldSlug = channel.slug;

    const updated = await prisma.$transaction(async (tx): Promise<"name_taken" | "limit_reached" | {
      id: string;
      name: string;
      slug: string;
      avatarUrl: string | null;
      ownerId: string;
      renameCount: number;
    } | null> => {
      if (newSlug !== oldSlug) {
        const slugTaken = await tx.channel.findFirst({
          where: { slug: newSlug, id: { not: channel.id } },
          select: { id: true },
        });
        if (slugTaken) {
          return "name_taken";
        }

        const historySlugTaken = await tx.channelSlugHistory.findFirst({
          where: { oldSlug: newSlug, channelId: { not: channel.id } },
          select: { id: true },
        });
        if (historySlugTaken) {
          return "name_taken";
        }
      }

      const result = await tx.channel.updateMany({
        where: { id: channel.id, ownerId: session.user.id, renameCount: { lt: MAX_RENAME_COUNT } },
        data: { name, normalizedName: normalizedTarget, slug: newSlug, renameCount: { increment: 1 } },
      });

      if (result.count === 0) {
        return "limit_reached";
      }

      if (newSlug !== oldSlug) {
        // Avoid P2002 if oldSlug is already in history (e.g. rename A→B→A→C).
        const oldInHistory = await tx.channelSlugHistory.findFirst({
          where: { oldSlug, channelId: channel.id },
          select: { id: true },
        });
        if (!oldInHistory) {
          await tx.channelSlugHistory.create({
            data: { oldSlug, oldNormalizedName: normalizeName(channel.name), channelId: channel.id },
          });
        }
      }

      return tx.channel.findUnique({
        where: { id: channel.id },
        select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true, renameCount: true },
      });
    });

    if (updated === "name_taken") {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    if (!updated || updated === "limit_reached") {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      logServerError("PATCH /api/channels/[slug] P2002 collision", error);
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }
    logServerError("PATCH /api/channels/[slug] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
