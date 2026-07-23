import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { compressR2Object } from "@/lib/services/upload";
import { compressSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError } from "@/lib/server-log";
import { parseBody } from "@/lib/parse-body";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
  }

  if (process.env.NODE_ENV === "production") {
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.upload, session.user.id, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, compressSchema, "POST /api/compress");
    if (parsed.response) return parsed.response;

    const { key } = parsed.data;

    // If Media records exist for this key, verify the caller owns ALL of them.
    // Otherwise, check PendingUpload for ownership of in-progress uploads.
    const storageDomain = process.env.R2_PUBLIC_URL;
    if (storageDomain) {
      const publicUrl = `${storageDomain.replace(/\/+$/, "")}/${key}`;
      const mediaOwners = await prisma.media.findMany({
        where: { url: publicUrl },
        select: { userId: true },
      });
      if (mediaOwners.length > 0) {
        if (mediaOwners.some((m) => m.userId !== session.user.id)) {
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
