import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { uploadUrlSchema } from "@/lib/validation";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, resetIn } = rateLimit(rateLimitKey("upload-url", session.user.id), 20, 3_600_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const parsed = uploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] || "input";
      return NextResponse.json(
        { error: `validation_error:${String(field)}:${issue.code}` },
        { status: 400 },
      );
    }

    const { fileName, contentType } = parsed.data;

    const { uploadUrl, publicUrl } = await createUploadUrl(
      fileName,
      contentType,
    );

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      mediaType: contentTypeToMediaType(contentType),
    });
  } catch (error) {
    console.error("POST /api/upload-url failed:", error);
    return NextResponse.json(
      { error: "failed_to_generate_upload_url" },
      { status: 500 },
    );
  }
}
