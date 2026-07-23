import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, BCRYPT_SALT_ROUNDS, normalizeName, isBrandNameBlocked, slugifyName } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError } from "@/lib/server-log";
import { parseBody } from "@/lib/parse-body";
import { serverError } from "@/lib/error-handlers";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_NAME_TAKEN } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_CREATED, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";

type RegistrationTx = {
  channel: {
    create: typeof prisma.channel.create;
  };
  channelTranslation: {
    findFirst: typeof prisma.channelTranslation.findFirst;
  };
  channelSlugHistory: {
    findFirst: typeof prisma.channelSlugHistory.findFirst;
  };
  user: {
    create: typeof prisma.user.create;
  };
};

async function createPersonalChannelForRegistration(
  tx: RegistrationTx,
  userId: string,
  userName: string,
): Promise<void> {
  const slug = slugifyName(userName);

  for (let i = 1; i <= 10; i++) {
    const finalSlug = i === 1 ? slug : `${slug}-${i}`;
    const name = i === 1 ? userName : `${userName} (${i})`;
    const normalized = normalizeName(name);

    const slugTaken = await tx.channelTranslation.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    if (slugTaken) continue;

    const slugInHistory = await tx.channelSlugHistory.findFirst({ where: { oldSlug: finalSlug }, select: { id: true } });
    if (slugInHistory) continue;

    const nameInHistory = await tx.channelSlugHistory.findFirst({ where: { oldNormalizedName: normalized }, select: { id: true } });
    if (nameInHistory) continue;

    try {
      await tx.channel.create({
        data: {
          ownerId: userId,
          isPersonal: true,
          translations: {
            create: { language: "en", name, normalizedName: normalized, slug: finalSlug },
          },
        },
      });
      return;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") continue;
      throw error;
    }
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  await tx.channel.create({
    data: {
      ownerId: userId,
      isPersonal: true,
      translations: {
        create: { language: "en", name: `${userName} (${uuid})`, normalizedName: normalizeName(`${userName} (${uuid})`), slug: `${slug}-${uuid}` },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.register, ip, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, registerSchema, "POST /api/register");
    if (parsed.response) return parsed.response;

    const { name, email, password } = parsed.data;

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, email)) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    // Reject if name (or a diacritic variant) is already taken by an active channel
    // or a renamed channel's slug history — otherwise a new user could claim a slug
    // that old links still point to, breaking the redirect.
    const normalizedTarget = normalizeName(name);
    const existing = await prisma.channelTranslation.findFirst({ where: { normalizedName: normalizedTarget }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    const historicalName = await prisma.channelSlugHistory.findFirst({
      where: { oldNormalizedName: normalizedTarget },
      select: { id: true },
    });
    if (historicalName) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, password: hashedPassword },
        select: { id: true, name: true, email: true },
      });

      // Create the personal channel inside the same transaction so a channel
      // failure cannot leave behind a half-created user account.
      await createPersonalChannelForRegistration(tx as RegistrationTx, createdUser.id, createdUser.name);
      return createdUser;
    });

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email },
      { status: HTTP_CREATED }
    );
  } catch (error) {
    // Unique-constraint collision (e.g. email already registered, or a channel
    // name/slug race). Return a generic error without revealing which field
    // collided, to avoid account/email enumeration.
    if ((error as { code?: string })?.code === "P2002") {
      logServerError("POST /api/register P2002 collision", error);
      return NextResponse.json(
        { error: "registration_failed" },
        { status: HTTP_BAD_REQUEST }
      );
    }
    return serverError("POST /api/register", error);
  }
}
