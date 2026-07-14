import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl } from "@/lib/services/upload";
import { batchUploadUrlSchema, MAX_TOTAL_UPLOAD_SIZE_BYTES, maxUploadSizeForContentType } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
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

  if (process.env.NODE_ENV === "production") {
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.upload, session.user.id, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
  }

  try {
    const body = await request.json();
    const parsed = batchUploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/upload-url/batch", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const { postId, files } = parsed.data;

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "validation_error:total_size:too_big" },
        { status: HTTP_BAD_REQUEST },
      );
    }

    for (const f of files) {
      if (f.size > maxUploadSizeForContentType(f.contentType)) {
        return NextResponse.json(
          { error: `validation_error:files.size:too_big:${f.fileName}` },
          { status: HTTP_BAD_REQUEST },
        );
      }
    }

    const results = await Promise.all(
      files.map((f) => createUploadUrl(f.fileName, f.contentType, postId, f.size)),
    );

    const pendingData = results.map((r) => ({
      key: r.key,
      userId: session.user.id,
      channelId: session.user.channelId,
      expiresAt: new Date(Date.now() + 3600_000),
    }));
    await prisma.pendingUpload.createMany({ data: pendingData });

    return NextResponse.json({ urls: results });
  } catch (error) {
    logServerError("POST /api/upload-url/batch failed", error);
    return NextResponse.json({ error: "failed_to_generate_upload_urls" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
