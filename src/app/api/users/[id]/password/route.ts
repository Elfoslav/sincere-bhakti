import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH, BCRYPT_SALT_ROUNDS } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_SERVER_ERROR, ERROR_NOT_FOUND, ERROR_INVALID_PASSWORD } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().trim().min(PASSWORD_MIN_LENGTH).max(128),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id || session.user.id !== id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.changePassword, id, RATE_LIMITS.changePassword.limit, RATE_LIMITS.changePassword.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("PATCH /api/users/[id]/password", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: ERROR_INVALID_PASSWORD }, { status: HTTP_BAD_REQUEST });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, sessionVersion: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("PATCH /api/users/[id]/password failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
