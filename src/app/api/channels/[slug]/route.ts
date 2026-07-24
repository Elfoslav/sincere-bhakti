import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageChannelSettings, getChannelBySlug, isNormalizedNameTaken, renameChannelTranslation } from "@/lib/services/channel";

import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { parseBody } from "@/lib/parse-body";
import { handlePrismaCollision, serverError } from "@/lib/error-handlers";
import { createChannelSchema, normalizeName, isBrandNameBlocked, slugifyName, MAX_RENAME_COUNT, isNameUnchanged } from "@/lib/validation";
import { ERROR_NOT_FOUND, ERROR_RENAME_LIMIT, ERROR_NAME_TAKEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";

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
    const language = new URL(request.url).searchParams.get("language") ?? "en";
    const channel = await getChannelBySlug(slug, language);

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    return NextResponse.json(channel);
  } catch (error) {
    return serverError("GET /api/channels/[slug]", error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updateChannel, RATE_LIMITS.updateChannel);
  if (auth.response) return auth.response;
  const session = auth.session;
  const { slug } = await params;

  try {
    const translation = await prisma.channelTranslation.findUnique({
      where: { slug },
      include: {
        channel: {
          select: { id: true, ownerId: true, isPersonal: true, avatarUrl: true, renameCount: true, defaultLanguage: true },
        },
      },
    });

    if (!translation) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const channel = translation.channel;
    const currentName = translation.name;
    const currentSlug = translation.slug;

    if (!await canManageChannelSettings(channel.id, session.user.id)) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (channel.isPersonal) {
      return NextResponse.json({ error: "cannot_rename_personal_channel" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = parseBody(body, createChannelSchema, "PATCH /api/channels/[slug]");
    if (parsed.response) return parsed.response;

    const { name } = parsed.data;

    const normalizedTarget = normalizeName(name);

    // Renaming to the same name is a no-op — don't count or write history
    if (isNameUnchanged(name, currentName)) {
      return NextResponse.json({
        id: channel.id,
        name: currentName,
        slug: currentSlug,
        avatarUrl: channel.avatarUrl,
        ownerId: channel.ownerId,
        renameCount: channel.renameCount,
      });
    }

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    if (channel.renameCount >= MAX_RENAME_COUNT) {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }

    // Check if the new name is already taken by another translation
    if (await isNormalizedNameTaken(normalizedTarget, channel.id)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    const newSlug = slugifyName(name);

    const updated = await prisma.$transaction((tx) => renameChannelTranslation(tx, {
      channelId: channel.id,
      userId: session.user.id,
      oldSlug: currentSlug,
      oldName: currentName,
      newName: name,
      newSlug,
      normalizedNewName: normalizedTarget,
      translationId: translation.id,
      currentRenameCount: channel.renameCount,
    }));

    if (updated === "name_taken") {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    if (updated === "limit_reached") {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }

    return NextResponse.json({
      ...updated,
      avatarUrl: channel.avatarUrl,
      ownerId: channel.ownerId,
    });
  } catch (error) {
    const collision = handlePrismaCollision(error, "PATCH /api/channels/[slug]");
    if (collision) return collision;
    return serverError("PATCH /api/channels/[slug]", error);
  }
}
