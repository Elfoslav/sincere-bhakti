import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema, BCRYPT_SALT_ROUNDS } from "@/lib/validation";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { parseBody } from "@/lib/parse-body";
import { serverError } from "@/lib/error-handlers";
import {
  ERROR_FORBIDDEN,
  ERROR_INVALID_VERIFICATION_TOKEN,
  ERROR_EXPIRED_VERIFICATION_TOKEN,
  ERROR_TOO_MANY_REQUESTS,
} from "@/lib/error-messages";
import {
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_OK,
} from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.resetPassword, ip, RATE_LIMITS.resetPassword.limit, RATE_LIMITS.resetPassword.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, resetPasswordSchema, "POST /api/auth/reset-password");
    if (parsed.response) return parsed.response;

    const { token, password } = parsed.data;

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ error: ERROR_INVALID_VERIFICATION_TOKEN }, { status: HTTP_BAD_REQUEST });
    }

    // Wrong type (e.g. a verify token submitted here): invalid, but don't delete
    // it — it may be a valid token for the other flow.
    if (record.type !== "reset") {
      return NextResponse.json({ error: ERROR_INVALID_VERIFICATION_TOKEN }, { status: HTTP_BAD_REQUEST });
    }

    if (record.expiresAt < new Date()) {
      await prisma.verificationToken.delete({ where: { id: record.id } });
      return NextResponse.json({ error: ERROR_EXPIRED_VERIFICATION_TOKEN }, { status: HTTP_BAD_REQUEST });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.email },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.verificationToken.delete({ where: { id: record.id } }),
    ]);

    return NextResponse.json({ reset: true }, { status: HTTP_OK });
  } catch (error) {
    return serverError("POST /api/auth/reset-password", error);
  }
}
