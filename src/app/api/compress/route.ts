import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { compressR2Object } from "@/lib/services/upload";
import { compressSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
  }

  if (process.env.NODE_ENV === "production") {
    const { allowed } = await rateLimit(rateLimitKey("upload", session.user.id), RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs);
    if (!allowed) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
  }

  try {
    const body = await request.json();
    const parsed = compressSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/compress", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const { key } = parsed.data;

    // If a Media record exists for this key, verify the caller owns it.
    // Otherwise, check PendingUpload for ownership of in-progress uploads.
    const storageDomain = process.env.R2_PUBLIC_URL;
    if (storageDomain) {
      const publicUrl = `${storageDomain.replace(/\/+$/, "")}/${key}`;
      const mediaOwner = await prisma.media.findFirst({
        where: { url: publicUrl },
        select: { userId: true },
      });
      if (mediaOwner) {
        if (mediaOwner.userId !== session.user.id) {
          return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
        }
      } else {
        const pending = await prisma.pendingUpload.findUnique({
          where: { key },
          select: { userId: true },
        });
        if (!pending || pending.userId !== session.user.id) {
          return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
        }
      }
    }

    const result = await compressR2Object(key);

    return NextResponse.json(result);
  } catch (error) {
    logServerError("POST /api/compress failed", error);
    return NextResponse.json({ error: "compress_failed" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
