import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, BCRYPT_SALT_ROUNDS, normalizeName, isBrandName } from "@/lib/validation";
import { createPersonalChannel } from "@/lib/services/channel";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_CREATED, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = await rateLimit(rateLimitKey("register", ip), RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
    if (!allowed) {
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

    // Reject if name matches the app's own brand name
    if (isBrandName(name, process.env.SINCERE_BHAKTI_NAME)) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    // Reject if name (or a diacritic variant) is already taken
    const normalizedTarget = normalizeName(name);
    const existing = await prisma.channel.findFirst({ where: { normalizedName: normalizedTarget }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "name_taken" }, { status: HTTP_CONFLICT });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true },
    });

    // Create personal channel immediately to lock the name
    await createPersonalChannel(user.id, user.name);

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email },
      { status: HTTP_CREATED }
    );
  } catch (error) {
    // Unique-constraint collision (e.g. email already registered, or a channel
    // name/slug race). Return a generic error without revealing which field
    // collided, to avoid account/email enumeration.
    if ((error as { code?: string })?.code === "P2002") {
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
