import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, BCRYPT_SALT_ROUNDS, normalizeName, isBrandNameBlocked, slugifyName } from "@/lib/validation";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_CREATED, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

type RegistrationTx = {
  channel: {
    findFirst: typeof prisma.channel.findFirst;
    create: typeof prisma.channel.create;
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

    const slugTaken = await tx.channel.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    if (slugTaken) continue;

    try {
      await tx.channel.create({
        data: { name, normalizedName: normalizeName(name), slug: finalSlug, ownerId: userId, isPersonal: true },
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
      name: `${userName} (${uuid})`,
      normalizedName: normalizeName(`${userName} (${uuid})`),
      slug: `${slug}-${uuid}`,
      ownerId: userId,
      isPersonal: true,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = await rateLimit(rateLimitKey("register", ip), RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!allowed) {
    console.warn("rate_limited", { route: "register", ip });
    return NextResponse.json(
      { error: ERROR_TOO_MANY_REQUESTS },
      { status: HTTP_TOO_MANY_REQUESTS },
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/register", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { name, email, password } = parsed.data;

    // Only the SINCERE_BHAKTI_EMAIL owner may use the brand name
    if (isBrandNameBlocked(name, email)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Reject if name (or a diacritic variant) is already taken
    const normalizedTarget = normalizeName(name);
    const existing = await prisma.channel.findFirst({ where: { normalizedName: normalizedTarget }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
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
    // Genuine server fault (DB down, etc.) — surface as 500, not a client error.
    logServerError("POST /api/register failed", error);
    return NextResponse.json(
      { error: ERROR_SERVER_ERROR },
      { status: HTTP_INTERNAL_SERVER_ERROR }
    );
  }
}
