import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { parseBody } from "@/lib/parse-body";
import { handlePrismaCollision, serverError } from "@/lib/error-handlers";
import { createChannelTranslationSchema, normalizeName, slugifyName, isBrandNameBlocked, isNameUnchanged } from "@/lib/validation";
import { canManageChannelSettings, findManageableTranslationBySlug, isNormalizedNameTaken, isPerLanguageSlugTaken, renameChannelTranslation, NameTakenError, RenameLimitError, CannotRenamePersonalChannelError } from "@/lib/services/channel";

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
    // The URL slug only identifies which channel to add a translation to; any
    // of its per-language slugs resolves the same channel.
    const translation = await findManageableTranslationBySlug(slug);
    if (!translation) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const channelId = translation.channel.id;
    if (!await canManageChannelSettings(channelId, session.user.id)) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const body = await request.json();
    const parsed = parseBody(body, createChannelTranslationSchema, "POST /api/channels/[slug]/translations");
    if (parsed.response) return parsed.response;

    const { name, language } = parsed.data;

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
            renameCount: existingTranslation.renameCount,
          };
        }

        if (translation.channel.isPersonal) {
          throw new CannotRenamePersonalChannelError();
        }

        const result = await renameChannelTranslation(tx, {
          channelId,
          userId: session.user.id,
          ownerId: translation.channel.ownerId,
          language: existingTranslation.language,
          oldSlug: existingTranslation.slug,
          oldName: existingTranslation.name,
          newName: name,
          newSlug,
          normalizedNewName: normalizedTarget,
          translationId: existingTranslation.id,
          currentRenameCount: existingTranslation.renameCount,
        });

        return {
          ...result,
          language: existingTranslation.language,
        };
      }

      // Name and slug BOTH gate uniqueness: reject if the derived slug is
      // already taken in this language (even when the name is free), rather than
      // auto-suffixing — consistent with createChannel and rename.
      if (await isPerLanguageSlugTaken(tx, language, newSlug)) throw new NameTakenError();
      const created = await tx.channelTranslation.create({
        data: { channelId, language, name, normalizedName: normalizedTarget, slug: newSlug },
      });
      return {
        id: created.id,
        language: created.language,
        name: created.name,
        slug: created.slug,
        renameCount: 0,
      };
    });

    return NextResponse.json(updated, { status: HTTP_CREATED });
  } catch (error) {
    if (error instanceof NameTakenError) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    if (error instanceof RenameLimitError) {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }
    if (error instanceof CannotRenamePersonalChannelError) {
      return NextResponse.json({ error: "cannot_rename_personal_channel" }, { status: HTTP_BAD_REQUEST });
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
    const translation = await findManageableTranslationBySlug(slug);
    if (!translation) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const channelId = translation.channel.id;
    if (!await canManageChannelSettings(channelId, session.user.id)) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Channel" WHERE id = ${channelId} FOR UPDATE`;

      const count = await tx.channelTranslation.count({ where: { channelId } });
      if (count <= 1) {
        throw new Error("cannot_remove_last_translation");
      }

      await tx.channelTranslation.deleteMany({ where: { channelId, language } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "cannot_remove_last_translation") {
      return NextResponse.json({ error: "cannot_remove_last_translation" }, { status: HTTP_BAD_REQUEST });
    }
    return serverError("DELETE /api/channels/[slug]/translations", error);
  }
}