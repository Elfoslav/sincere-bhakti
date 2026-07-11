import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateNameSchema, normalizeName, isBrandName } from "@/lib/validation";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_CONFLICT, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        channels: {
          where: { ownerId: id },
          select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true, _count: { select: { posts: { where: { isPublic: true } } } } },
        },
        ...(session?.user?.id === id ? { email: true } : {}),
      },
    });

    if (!user) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const { channels, ...profile } = user;
    return NextResponse.json({ ...profile, channels: channels.map(({ _count, ...ch }) => ({ ...ch, postCount: _count.posts })) });
  } catch (error) {
    logServerError("GET /api/users/[id] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }

    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id || session.user.id !== id) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }

    const { allowed } = await rateLimit(rateLimitKey("update-profile", id), RATE_LIMITS.updateProfile.limit, RATE_LIMITS.updateProfile.windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: ERROR_TOO_MANY_REQUESTS },
        { status: HTTP_TOO_MANY_REQUESTS },
      );
    }

    const body = await request.json();
    const parsed = updateNameSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("PATCH /api/users/[id]", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    // Reject if name matches the app's own brand name
    if (isBrandName(parsed.data.name, process.env.SINCERE_BHAKTI_NAME)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Check if the new name is already taken by another channel (strip diacritics)
    const normalizedTarget = normalizeName(parsed.data.name);
    const existing = await prisma.channel.findFirst({ where: { normalizedName: normalizedTarget, ownerId: { not: id } }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { name: parsed.data.name },
        select: { id: true, name: true, email: true, image: true, createdAt: true },
      });

      // Sync the personal channel name and normalized name but NOT the slug
      const personalChannel = await tx.channel.findFirst({
        where: { ownerId: id, isPersonal: true },
      });
      if (personalChannel) {
        await tx.channel.update({
          where: { id: personalChannel.id },
          data: { name: parsed.data.name, normalizedName: normalizeName(parsed.data.name) },
        });
      }

      return updated;
    });

    return NextResponse.json(user);
  } catch (error) {
    logServerError("PATCH /api/users/[id] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
