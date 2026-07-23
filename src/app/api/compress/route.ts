import { NextRequest, NextResponse } from "next/server";
import { compressR2Object } from "@/lib/services/upload";
import { compressSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { ERROR_FORBIDDEN, ERROR_UNAUTHORIZED } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.upload, RATE_LIMITS.upload, { skipRateLimit: process.env.NODE_ENV !== "production", authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (auth.response) return auth.response;
  const session = auth.session;

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
    return serverError("POST /api/compress", error, "compress_failed");
  }
}
