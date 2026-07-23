import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { parseBody } from "@/lib/parse-body";
import { handlePrismaCollision, serverError } from "@/lib/error-handlers";
import { createChannelSchema, normalizeName, slugifyName, isBrandNameBlocked, isNameUnchanged } from "@/lib/validation";
import { canManageChannelSettings, isNormalizedNameTaken, renameChannelTranslation } from "@/lib/services/channel";

import { ERROR_NOT_FOUND, ERROR_NAME_TAKEN, ERROR_RENAME_LIMIT } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_CREATED, HTTP_NOT_FOUND } from "@/lib/error-codes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updateChannel, RATE_LIMITS.updateChannel);
  if (auth.response) return auth.response;
  const session = auth.session;
  const { slug } = await params;

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
    const parsed = parseBody(body, createChannelSchema, "POST /api/channels/[slug]/translations");
    if (parsed.response) return parsed.response;

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

    const existingTranslation = await prisma.channelTranslation.findUnique({
      where: { channelId_language: { channelId, language } },
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (existingTranslation) {
        if (isNameUnchanged(name, existingTranslation.name)) {
          return {
            id: existingTranslation.id,
            language: existingTranslation.language,
            name: existingTranslation.name,
            slug: existingTranslation.slug,
            renameCount: channelInfo.renameCount,
          };
        }

        if (channelInfo.isPersonal) {
          throw new Error("cannot_rename_personal_channel");
        }

        const result = await renameChannelTranslation(tx, {
          channelId,
          userId: session.user.id,
          oldSlug: existingTranslation.slug,
          oldName: existingTranslation.name,
          newName: name,
          newSlug,
          normalizedNewName: normalizedTarget,
          translationId: existingTranslation.id,
          currentRenameCount: channelInfo.renameCount,
        });

        if (typeof result === "string") {
          throw new Error(result);
        }

        return {
          ...result,
          language: existingTranslation.language,
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
      if (error.message === "limit_reached") {
        return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
      }
      if (error.message === "cannot_rename_personal_channel") {
        return NextResponse.json({ error: "cannot_rename_personal_channel" }, { status: HTTP_BAD_REQUEST });
      }
    }
    const collision = handlePrismaCollision(error, "POST /api/channels/[slug]/translations");
    if (collision) return collision;
    return serverError("POST /api/channels/[slug]/translations", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updateChannel, RATE_LIMITS.updateChannel);
  if (auth.response) return auth.response;
  const session = auth.session;
  const { slug } = await params;
  const language = new URL(request.url).searchParams.get("language");
  if (!language) {
    return NextResponse.json({ error: "validation_error:language:required" }, { status: HTTP_BAD_REQUEST });
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
    return serverError("DELETE /api/channels/[slug]/translations", error);
  }
}