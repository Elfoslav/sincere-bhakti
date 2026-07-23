import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { createChannelSchema, normalizeName, slugifyName, isBrandNameBlocked, MAX_RENAME_COUNT } from "@/lib/validation";
import { canManageChannelSettings, isNormalizedNameTaken } from "@/lib/services/channel";
import { CHANNEL_ROLE_ADMIN } from "@/lib/channel-roles";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_SERVER_ERROR, ERROR_TOO_MANY_REQUESTS, ERROR_NAME_TAKEN, ERROR_RENAME_LIMIT } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_CREATED, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

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

  const { slug } = await params;

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateChannel, session.user.id, RATE_LIMITS.updateChannel.limit, RATE_LIMITS.updateChannel.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const translation = await prisma.channelTranslation.findUnique({
      where: { slug },
      include: {
        channel: { select: { id: true, ownerId: true, isPersonal: true, renameCount: true } },
      },
    });
    if (!translation) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const channelId = translation.channel.id;
    const channelInfo = translation.channel;
    if (!await canManageChannelSettings(channelId, session.user.id)) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/channels/[slug]/translations", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const { name, language } = parsed.data;
    if (!language) {
      return NextResponse.json({ error: "validation_error:language:required" }, { status: HTTP_BAD_REQUEST });
    }

    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    if (await isNormalizedNameTaken(normalizeName(name), channelId)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    const newSlug = slugifyName(name);
    const normalizedTarget = normalizeName(name);

    const updated = await prisma.$transaction(async (tx) => {
      const existingTranslation = await tx.channelTranslation.findUnique({
        where: { channelId_language: { channelId, language } },
      });

      // Slug is globally unique, so a hit on the row we're editing is not a
      // conflict — that's just re-saving with an unchanged name. Only a
      // DIFFERENT translation holding this slug is a real collision.
      const slugTaken = await tx.channelTranslation.findUnique({
        where: { slug: newSlug },
        select: { id: true },
      });
      if (slugTaken && slugTaken.id !== existingTranslation?.id) throw new Error("name_taken");

      const historySlugTaken = await tx.channelSlugHistory.findFirst({
        where: { oldSlug: newSlug, channelId: { not: channelId } },
        select: { id: true },
      });
      if (historySlugTaken) throw new Error("name_taken");

      if (existingTranslation) {
        if (normalizedTarget !== normalizeName(existingTranslation.name)) {
          if (channelInfo.isPersonal) {
            throw new Error("cannot_rename_personal_channel");
          }

          const result = await tx.channel.updateMany({
            where: {
              id: channelId,
              renameCount: { lt: MAX_RENAME_COUNT },
              OR: [
                { ownerId: session.user.id },
                { editors: { some: { userId: session.user.id, role: CHANNEL_ROLE_ADMIN } } },
              ],
            },
            data: { renameCount: { increment: 1 } },
          });

          if (result.count === 0) {
            throw new Error("rename_limit_reached");
          }

          // Record the old slug so it cannot be reclaimed by other channels
          const oldInHistory = await tx.channelSlugHistory.findFirst({
            where: { oldSlug: existingTranslation.slug, channelId },
            select: { id: true },
          });
          if (!oldInHistory) {
            await tx.channelSlugHistory.create({
              data: {
                oldSlug: existingTranslation.slug,
                oldNormalizedName: normalizeName(existingTranslation.name),
                channelId,
              },
            });
          }
        }

        const updated = await tx.channelTranslation.update({
          where: { id: existingTranslation.id },
          data: { name, normalizedName: normalizedTarget, slug: newSlug },
        });

        const newRenameCount = normalizedTarget !== normalizeName(existingTranslation.name)
          ? channelInfo.renameCount + 1
          : channelInfo.renameCount;

        return {
          id: updated.id,
          language: updated.language,
          name: updated.name,
          slug: updated.slug,
          renameCount: newRenameCount,
        };
      }

      const created = await tx.channelTranslation.create({
        data: { channelId, language, name, normalizedName: normalizedTarget, slug: newSlug },
      });
      return {
        id: created.id,
        language: created.language,
        name: created.name,
        slug: created.slug,
        renameCount: channelInfo.renameCount,
      };
    });

    return NextResponse.json(updated, { status: HTTP_CREATED });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "name_taken") {
        return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
      }
      if (error.message === "rename_limit_reached") {
        return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
      }
      if (error.message === "cannot_rename_personal_channel") {
        return NextResponse.json({ error: "cannot_rename_personal_channel" }, { status: HTTP_BAD_REQUEST });
      }
    }
    if ((error as { code?: string })?.code === "P2002") {
      logServerError("POST /api/channels/[slug]/translations P2002 collision", error);
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    logServerError("POST /api/channels/[slug]/translations failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(
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

  const { slug } = await params;
  const language = new URL(request.url).searchParams.get("language");
  if (!language) {
    return NextResponse.json({ error: "validation_error:language:required" }, { status: HTTP_BAD_REQUEST });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.updateChannel, session.user.id, RATE_LIMITS.updateChannel.limit, RATE_LIMITS.updateChannel.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const translation = await prisma.channelTranslation.findUnique({
      where: { slug },
      include: {
        channel: { select: { id: true } },
      },
    });
    if (!translation) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const channelId = translation.channel.id;
    if (!await canManageChannelSettings(channelId, session.user.id)) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const translationCount = await prisma.channelTranslation.count({
      where: { channelId },
    });

    if (translationCount <= 1) {
      return NextResponse.json({ error: "cannot_remove_last_translation" }, { status: HTTP_BAD_REQUEST });
    }

    await prisma.channelTranslation.deleteMany({
      where: { channelId, language },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("DELETE /api/channels/[slug]/translations failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}