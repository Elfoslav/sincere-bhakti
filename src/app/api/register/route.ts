import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, BCRYPT_SALT_ROUNDS, normalizeName, isBrandNameBlocked, slugifyName } from "@/lib/validation";
import { getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-log";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { ERROR_NAME_TAKEN } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_CREATED } from "@/lib/error-codes";
import { generateVerificationTokenValue, VERIFY_TOKEN_TTL_MS } from "@/lib/verification-token";
import { sendVerificationEmail } from "@/lib/email";

type RegistrationTx = {
  channel: {
    create: typeof prisma.channel.create;
  };
};

async function createPersonalChannelForRegistration(
  tx: RegistrationTx,
  userId: string,
  userName: string,
  language: string = "en",
): Promise<void> {
  // Name and slug collisions are rejected up front in the POST handler (see the
  // pre-transaction checks), so this creates the personal channel with the
  // user's name and its derived slug directly — no auto-suffixing. A concurrent
  // race that slips past the pre-checks surfaces as a P2002 and rolls the whole
  // registration back to a generic "registration_failed".
  await tx.channel.create({
    data: {
      ownerId: userId,
      isPersonal: true,
      translations: {
        create: { language, name: userName, normalizedName: normalizeName(userName), slug: slugifyName(userName) },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request, RATE_LIMIT_PREFIX.register, RATE_LIMITS.register, {
    skipAuth: true,
    rateLimitIdentifier: getClientIp(request.headers),
  });
  if (guard.response) return guard.response;

  try {
    const body = await request.json();
    const parsed = parseBody(body, registerSchema, "POST /api/register");
    if (parsed.response) return parsed.response;

    const { name, email, password, language } = parsed.data;

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

    // Name and slug BOTH gate uniqueness (reject, don't auto-suffix): also block
    // when the personal-channel slug is already taken in this language — even if
    // the name itself is free (e.g. "Devotees!" vs an existing "Devotees").
    const registrationLanguage = language ?? "en";
    const targetSlug = slugifyName(name);
    const slugTaken = await prisma.channelTranslation.findFirst({
      where: { language: registrationLanguage, slug: targetSlug },
      select: { id: true },
    });
    if (slugTaken) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }
    const slugInHistory = await prisma.channelSlugHistory.findFirst({
      where: { language: registrationLanguage, oldSlug: targetSlug },
      select: { id: true },
    });
    if (slugInHistory) {
      return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const verifyToken = generateVerificationTokenValue();
    const verifyExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, password: hashedPassword },
        select: { id: true, name: true, email: true },
      });

      // Create the personal channel inside the same transaction so a channel
      // failure cannot leave behind a half-created user account.
      await createPersonalChannelForRegistration(tx as RegistrationTx, createdUser.id, createdUser.name, registrationLanguage);

      await tx.verificationToken.create({
        data: {
          email: createdUser.email,
          token: verifyToken,
          type: "verify",
          expiresAt: verifyExpires,
        },
      });

      return createdUser;
    });

    // Send verification email outside the transaction — a transient SES failure
    // should not roll back the user account.
    try {
      await sendVerificationEmail(user.email, verifyToken, parsed.data.language ?? "en");
    } catch (error) {
      logServerError("POST /api/register sendVerificationEmail", error);
    }

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, emailSent: true },
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
