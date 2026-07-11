import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getChannelBySlug, isNormalizedNameTaken } from "@/lib/services/channel";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { createChannelSchema, normalizeName, isBrandNameBlocked, slugifyName } from "@/lib/validation";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_SERVER_ERROR, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = await rateLimit(rateLimitKey("read-channel", ip), RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs);
    if (!allowed) {
      console.warn("rate_limited", { route: "read-channel", ip });
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

  const { allowed } = await rateLimit(rateLimitKey("update-channel", session.user.id), RATE_LIMITS.updateChannel.limit, RATE_LIMITS.updateChannel.windowMs);
  if (!allowed) {
    console.warn("rate_limited", { route: "update-channel", userId: session.user.id });
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { slug },
      select: { id: true, name: true, ownerId: true, isPersonal: true, slug: true },
    });

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (channel.ownerId !== session.user.id) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
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

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, session.user.email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Check if the new name is already taken by another channel
    const normalizedTarget = normalizeName(name);
    if (await isNormalizedNameTaken(normalizedTarget, channel.id)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const newSlug = slugifyName(name);
    const oldSlug = channel.slug;

    const finalSlug = newSlug;
    if (newSlug !== oldSlug) {
      // Check if the new slug is already taken by another channel or history.
      const slugTaken = await prisma.channel.findFirst({
        where: { slug: newSlug, id: { not: channel.id } },
        select: { id: true },
      });
      if (slugTaken) {
        return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
      }
    }

    if (oldSlug !== finalSlug) {
      await prisma.channelSlugHistory.create({
        data: { oldSlug, oldNormalizedName: normalizeName(channel.name), channelId: channel.id },
      });
    }

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: { name, normalizedName: normalizedTarget, slug: finalSlug },
      select: { id: true, name: true, slug: true, avatarUrl: true, ownerId: true },
    });

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
