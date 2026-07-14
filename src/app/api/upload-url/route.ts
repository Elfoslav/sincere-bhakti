import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { uploadUrlSchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
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

  if (!await checkRateLimit("upload-url", session.user.id, RATE_LIMITS.uploadUrl.limit, RATE_LIMITS.uploadUrl.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = uploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/upload-url", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const { fileName, contentType, postId, contentLength } = parsed.data;

    const { uploadUrl, publicUrl, key } = await createUploadUrl(
      fileName,
      contentType,
      postId,
      contentLength,
    );

    if (key) {
      await prisma.pendingUpload.create({
        data: {
          key,
          userId: session.user.id,
          channelId: session.user.channelId,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
    }

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      mediaType: contentTypeToMediaType(contentType),
    });
  } catch (error) {
    logServerError("POST /api/upload-url failed", error);
    return NextResponse.json(
      { error: "failed_to_generate_upload_url" },
      { status: HTTP_INTERNAL_SERVER_ERROR },
    );
  }
}
