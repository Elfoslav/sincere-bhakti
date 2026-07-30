import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { parseBody } from "@/lib/parse-body";
import { serverError } from "@/lib/error-handlers";
import { logServerError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_OK } from "@/lib/error-codes";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const ip = getClientIp(request.headers);
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.forgotPassword, ip, RATE_LIMITS.forgotPassword.limit, RATE_LIMITS.forgotPassword.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, forgotPasswordSchema, "POST /api/auth/forgot-password");
    if (parsed.response) return parsed.response;

    const { email, language } = parsed.data;

    // Always return 200 to prevent email enumeration.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Do the token write + email send AFTER the response so the response time
    // is identical whether or not the user exists (the SES round-trip would
    // otherwise leak account existence via latency). `after` keeps the work
    // alive past the response on serverless, so the email is still delivered.
    if (user) {
      after(async () => {
        try {
          const resetToken = crypto.randomBytes(32).toString("hex");
          const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

          // Delete any existing reset tokens for this email to prevent accumulation.
          await prisma.verificationToken.deleteMany({
            where: { email, type: "reset" },
          });

          await prisma.verificationToken.create({
            data: { email, token: resetToken, type: "reset", expiresAt: resetExpires },
          });

          await sendPasswordResetEmail(email, resetToken, language ?? "en");
        } catch (error) {
          logServerError("POST /api/auth/forgot-password reset", error);
        }
      });
    }

    return NextResponse.json({ sent: true }, { status: HTTP_OK });
  } catch (error) {
    return serverError("POST /api/auth/forgot-password", error);
  }
}
