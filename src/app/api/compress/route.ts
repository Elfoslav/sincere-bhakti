import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { compressR2Object } from "@/lib/services/upload";
import { compressSchema } from "@/lib/validation";
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
    const parsed = compressSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/compress", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: 400 },
      );
    }

    const { key } = parsed.data;
    const result = await compressR2Object(key);

    return NextResponse.json(result);
  } catch (error) {
    logServerError("POST /api/compress failed", error);
    return NextResponse.json({ error: "compress_failed" }, { status: 500 });
  }
}
