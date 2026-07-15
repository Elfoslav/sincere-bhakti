import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateNameSchema, normalizeName, isBrandNameBlocked, slugifyName, MAX_RENAME_COUNT } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR, ERROR_RENAME_LIMIT } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_CONFLICT, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

class NameTakenError extends Error {
  name = "NameTakenError" as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readProfile, ip, RATE_LIMITS.readProfile.limit, RATE_LIMITS.readProfile.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { id } = await params;

    const session = await auth();

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        renameCount: true,
        channels: {
          where: { ownerId: id },
          select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true, isPersonal: true, _count: { select: { posts: { where: { isPublic: true } } } } },
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

    if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateProfile, id, RATE_LIMITS.updateProfile.limit, RATE_LIMITS.updateProfile.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
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

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(parsed.data.name, session.user.email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const normalizedTarget = normalizeName(parsed.data.name);

    // Renaming to the same name is a no-op — don't count or write history
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { name: true, renameCount: true, email: true, image: true, createdAt: true },
    });
    if (currentUser && normalizeName(currentUser.name) === normalizedTarget) {
      return NextResponse.json({ ...currentUser, id });
    }

    // All name/slug checks and writes happen inside a single transaction so a
    // concurrent rename cannot make the personal-channel snapshot or collision
    // checks stale.
    const updated = await prisma.$transaction(async (tx) => {
      const userCurrent = await tx.user.findUnique({
        where: { id },
        select: { renameCount: true },
      });
      if (!userCurrent) throw new Error("internal_user_not_found");
      if (userCurrent.renameCount >= MAX_RENAME_COUNT) {
        throw new Error("rename_limit_reached");
      }

      const personalChannel = await tx.channel.findFirst({
        where: { ownerId: id, isPersonal: true },
        select: { id: true, name: true, slug: true },
      });

      // Check normalized-name collision inside the transaction (authoritative).
      const nameCollision = await tx.channel.findFirst({
        where: { normalizedName: normalizedTarget, id: personalChannel ? { not: personalChannel.id } : undefined },
        select: { id: true },
      });
      if (nameCollision) throw new NameTakenError();
      const nameHistoryCollision = await tx.channelSlugHistory.findFirst({
        where: { oldNormalizedName: normalizedTarget, channelId: personalChannel ? { not: personalChannel.id } : undefined },
        select: { id: true },
      });
      if (nameHistoryCollision) throw new NameTakenError();

      const user = await tx.user.update({
        where: { id },
        data: { name: parsed.data.name, renameCount: { increment: 1 } },
        select: { id: true, name: true, email: true, image: true, createdAt: true, renameCount: true },
      });

      if (personalChannel) {
        const newSlug = slugifyName(parsed.data.name);
        const oldSlug = personalChannel.slug;

        if (oldSlug !== newSlug) {
          const slugTaken = await tx.channel.findFirst({
            where: { slug: newSlug, id: { not: personalChannel.id } },
            select: { id: true },
          });
          if (slugTaken) throw new NameTakenError();

          const historySlugTaken = await tx.channelSlugHistory.findFirst({
            where: { oldSlug: newSlug, channelId: { not: personalChannel.id } },
            select: { id: true },
          });
          if (historySlugTaken) throw new NameTakenError();

          const oldInHistory = await tx.channelSlugHistory.findFirst({
            where: { oldSlug, channelId: personalChannel.id },
            select: { id: true },
          });
          if (!oldInHistory) {
            await tx.channelSlugHistory.create({
              data: { oldSlug, oldNormalizedName: normalizeName(personalChannel.name), channelId: personalChannel.id },
            });
          }
        }

        await tx.channel.update({
          where: { id: personalChannel.id },
          data: { name: parsed.data.name, normalizedName: normalizeName(parsed.data.name), slug: newSlug },
        });
      }

      return user;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof NameTakenError) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }
    if (error instanceof Error && error.message === "rename_limit_reached") {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }
    logServerError("PATCH /api/users/[id] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
