import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateNameSchema, normalizeName, isBrandNameBlocked, slugifyName } from "@/lib/validation";
import { isNormalizedNameTaken } from "@/lib/services/channel";
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

    const { allowed } = await rateLimit(rateLimitKey("update-profile", id), RATE_LIMITS.updateProfile.limit, RATE_LIMITS.updateProfile.windowMs);
    if (!allowed) {
      console.warn("rate_limited", { route: "update-profile", userId: id });
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

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(parsed.data.name, session.user.email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Check if the new name is already taken by any other channel (name is globally unique).
    // Exclude only the caller's personal channel since that is the one being renamed.
    const normalizedTarget = normalizeName(parsed.data.name);
    const personalChannel = await prisma.channel.findFirst({
      where: { ownerId: id, isPersonal: true },
      select: { id: true, name: true, slug: true },
    });
    if (await isNormalizedNameTaken(normalizedTarget, personalChannel?.id)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Validate slug collisions before committing the user update. If the new slug
    // collides with another channel/history, return 409 before any writes.
    if (personalChannel) {
      const newSlug = slugifyName(parsed.data.name);
      const oldSlug = personalChannel.slug;
      if (oldSlug !== newSlug) {
        const slugTaken = await prisma.channel.findFirst({
          where: { slug: newSlug, id: { not: personalChannel.id } },
          select: { id: true },
        });
        if (slugTaken) {
          return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
        }

        const historySlugTaken = await prisma.channelSlugHistory.findFirst({
          where: { oldSlug: newSlug, channelId: { not: personalChannel.id } },
          select: { id: true },
        });
        if (historySlugTaken) {
          return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });

    // Sync the personal channel name to match the user's display name.
    if (personalChannel) {
      const newSlug = slugifyName(parsed.data.name);
      const oldSlug = personalChannel.slug;

      if (oldSlug !== newSlug) {
        // Avoid P2002 if oldSlug is already in history (e.g. name A→B→A→C).
        const oldInHistory = await prisma.channelSlugHistory.findFirst({
          where: { oldSlug, channelId: personalChannel.id },
          select: { id: true },
        });
        if (!oldInHistory) {
          await prisma.channelSlugHistory.create({
            data: { oldSlug, oldNormalizedName: normalizeName(personalChannel.name), channelId: personalChannel.id },
          });
        }
      }

      await prisma.channel.update({
        where: { id: personalChannel.id },
        data: { name: parsed.data.name, normalizedName: normalizeName(parsed.data.name), slug: newSlug },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logServerError("PATCH /api/users/[id] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
