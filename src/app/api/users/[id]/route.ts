import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateNameSchema, normalizeName, isBrandNameBlocked, slugifyName, MAX_RENAME_COUNT } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR, ERROR_RENAME_LIMIT, ERROR_NAME_TAKEN } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_CONFLICT, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";
import { getMaxChannelsPerUser } from "@/lib/channel-limit";
import { resolveTranslation } from "@/lib/channel-translation";
import type { ChannelMemberRole } from "@/lib/channel-roles";

class NameTakenError extends Error {
  name = "NameTakenError" as const;
}

type ManagedChannelSelection = {
  role: ChannelMemberRole;
  channel: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    ownerId: string;
    isPersonal: boolean;
    _count: { posts: number };
    translations: { language: string; name: string; slug: string }[];
  };
};

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
    const language = new URL(request.url).searchParams.get("language") ?? "en";

    const session = await auth();
    const isOwnProfile = session?.user?.id === id;

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
          select: { id: true, avatarUrl: true, ownerId: true, isPersonal: true, _count: { select: { posts: { where: { isPublic: true } } } }, translations: { select: { language: true, name: true, slug: true } } },
        },
        ...(isOwnProfile ? {
          email: true,
          editors: {
            where: { channel: { ownerId: { not: id } } },
            select: {
              role: true,
              channel: {
                select: {
                  id: true,
                  avatarUrl: true,
                  ownerId: true,
                  isPersonal: true,
                  _count: { select: { posts: { where: { isPublic: true } } } },
                  translations: { select: { language: true, name: true, slug: true } },
                },
              },
            },
            orderBy: [{ channelId: "asc" }],
          },
        } : {}),
      },
    });

    if (!user) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const { channels, editors = [], ...profile } = user;
    const managedEditors = editors as unknown as ManagedChannelSelection[];
    const additionalChannelCount = channels.filter((channel) => !channel.isPersonal).length;

    return NextResponse.json({
      ...profile,
      additionalChannelCount,
      channelLimit: getMaxChannelsPerUser(),
      channels: channels.map(({ _count, translations, ...ch }) => {
        const t = resolveTranslation(translations, language) ?? { name: "", slug: "" };
        return { ...ch, name: t.name, slug: t.slug, postCount: _count.posts };
      }),
      managedChannels: managedEditors.map(({ role, channel }) => {
        const { _count, translations, ...ch } = channel;
        const t = resolveTranslation(translations, language) ?? { name: "", slug: "" };
        return { ...ch, name: t.name, slug: t.slug, role: role as ChannelMemberRole, postCount: _count.posts };
      }),
    });
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

    const normalizedTarget = normalizeName(parsed.data.name);

    // Renaming to the same name is a no-op — don't count or write history
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { name: true, renameCount: true, email: true, image: true, createdAt: true },
    });
    if (currentUser && normalizeName(currentUser.name) === normalizedTarget) {
      return NextResponse.json({ ...currentUser, id });
    }

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(parsed.data.name, session.user.email)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    // All name/slug checks and writes happen inside a single transaction so a
    // concurrent rename cannot make the personal-channel snapshot or collision
    // checks stale.
    const updated = await prisma.$transaction(async (tx) => {
      const renameResult = await tx.user.updateMany({
        where: { id, renameCount: { lt: MAX_RENAME_COUNT } },
        data: { name: parsed.data.name, renameCount: { increment: 1 } },
      });
      if (renameResult.count === 0) {
        throw new Error("rename_limit_reached");
      }

      const personalChannel = await tx.channel.findFirst({
        where: { ownerId: id, isPersonal: true },
        select: { id: true },
      });

      let personalTranslation: { id: string; channelId: string; language: string; name: string; slug: string } | null = null;
      if (personalChannel) {
        personalTranslation = await tx.channelTranslation.findFirst({
          where: { channelId: personalChannel.id },
          orderBy: { language: "asc" },
          select: { id: true, channelId: true, language: true, name: true, slug: true },
        });
      }

      // Check normalized-name collision inside the transaction (authoritative).
      const nameCollision = await tx.channelTranslation.findFirst({
        where: { normalizedName: normalizedTarget, channelId: personalChannel ? { not: personalChannel.id } : undefined },
        select: { id: true },
      });
      if (nameCollision) throw new NameTakenError();
      const nameHistoryCollision = await tx.channelSlugHistory.findFirst({
        where: { oldNormalizedName: normalizedTarget, channelId: personalChannel ? { not: personalChannel.id } : undefined },
        select: { id: true },
      });
      if (nameHistoryCollision) throw new NameTakenError();

      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, image: true, createdAt: true, renameCount: true },
      });
      let updatedPersonalChannel: { id: string; name: string; slug: string } | null = null;

      if (personalTranslation) {
        const newSlug = slugifyName(parsed.data.name);
        const oldSlug = personalTranslation.slug;

        if (oldSlug !== newSlug) {
          const slugTaken = await tx.channelTranslation.findUnique({
            where: { slug: newSlug },
            select: { id: true },
          });
          if (slugTaken) throw new NameTakenError();

          const historySlugTaken = await tx.channelSlugHistory.findFirst({
            where: { oldSlug: newSlug, channelId: { not: personalTranslation.channelId } },
            select: { id: true },
          });
          if (historySlugTaken) throw new NameTakenError();

          const oldInHistory = await tx.channelSlugHistory.findFirst({
            where: { oldSlug, channelId: personalTranslation.channelId },
            select: { id: true },
          });
          if (!oldInHistory) {
            await tx.channelSlugHistory.create({
              data: { oldSlug, oldNormalizedName: normalizeName(personalTranslation.name), channelId: personalTranslation.channelId },
            });
          }
        }

        await tx.channelTranslation.update({
          where: { id: personalTranslation.id },
          data: { name: parsed.data.name, normalizedName: normalizeName(parsed.data.name), slug: newSlug },
        });
        updatedPersonalChannel = { id: personalTranslation.channelId, name: parsed.data.name, slug: newSlug };
      }

      return { ...user, personalChannel: updatedPersonalChannel };
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof NameTakenError) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    if (error instanceof Error && error.message === "rename_limit_reached") {
      return NextResponse.json({ error: ERROR_RENAME_LIMIT }, { status: HTTP_BAD_REQUEST });
    }
    logServerError("PATCH /api/users/[id] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
