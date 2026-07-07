import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl } from "@/lib/services/upload";
import { batchUploadUrlSchema, MAX_TOTAL_UPLOAD_SIZE_BYTES, maxUploadSizeForContentType } from "@/lib/validation";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production") {
    const { allowed } = await rateLimit(rateLimitKey("upload", session.user.id), RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs);
    if (!allowed) {
      return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
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
        { status: 400 },
      );
    }

    const { postId, files } = parsed.data;

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "validation_error:total_size:too_big" },
        { status: 400 },
      );
    }

    for (const f of files) {
      if (f.size > maxUploadSizeForContentType(f.contentType)) {
        return NextResponse.json(
          { error: `validation_error:files.size:too_big:${f.fileName}` },
          { status: 400 },
        );
      }
    }

    const results = await Promise.all(
      files.map((f) => createUploadUrl(f.fileName, f.contentType, postId)),
    );

    return NextResponse.json({ urls: results });
  } catch (error) {
    logServerError("POST /api/upload-url/batch failed", error);
    return NextResponse.json({ error: "failed_to_generate_upload_urls" }, { status: 500 });
  }
}
