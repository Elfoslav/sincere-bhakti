import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueVerificationToken, VERIFY_TOKEN_TTL_MS } from "@/lib/verification-token";
import { requireAuth } from "@/lib/require-auth";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { serverError } from "@/lib/error-handlers";
import { logServerError } from "@/lib/server-log";
import { sendVerificationEmail } from "@/lib/email";
import { ERROR_NOT_FOUND } from "@/lib/error-messages";
import { HTTP_OK, HTTP_NOT_FOUND } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.resendVerification, RATE_LIMITS.resendVerification);
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const body = await request.json().catch(() => ({}));
    const locale = body?.locale ?? "en";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ verified: true }, { status: HTTP_OK });
    }

    const verifyToken = await issueVerificationToken(user.email, "verify", VERIFY_TOKEN_TTL_MS);

    try {
      await sendVerificationEmail(user.email, verifyToken, locale);
    } catch (error) {
      logServerError("POST /api/auth/resend-verification sendVerificationEmail", error);
    }

    return NextResponse.json({ sent: true }, { status: HTTP_OK });
  } catch (error) {
    return serverError("POST /api/auth/resend-verification", error);
  }
}
