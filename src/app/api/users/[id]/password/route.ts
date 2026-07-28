import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH, BCRYPT_SALT_ROUNDS } from "@/lib/validation";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_INVALID_PASSWORD } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "@/lib/error-codes";

const changePasswordSchema = z.object({
  currentPassword: z.string().trim().min(1),
  newPassword: z.string().trim().min(PASSWORD_MIN_LENGTH).max(128),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.changePassword, RATE_LIMITS.changePassword);
  if (auth.response) return auth.response;
  const session = auth.session;
  const { id } = await params;

  if (session.user.id !== id) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, changePasswordSchema, "PATCH /api/users/[id]/password");
    if (parsed.response) return parsed.response;

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
    return serverError("PATCH /api/users/[id]/password", error);
  }
}
