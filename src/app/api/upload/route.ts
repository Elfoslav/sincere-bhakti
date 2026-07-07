import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processAndUpload } from "@/lib/services/upload";
import { isAllowedUploadContentType, maxUploadSizeForContentType } from "@/lib/validation";
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

  const { allowed } = await rateLimit(rateLimitKey("upload", session.user.id), 20, 3_600_000);
  if (!allowed) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "validation_error:file:required" }, { status: 400 });
    }

    if (!isAllowedUploadContentType(file.type)) {
      return NextResponse.json({ error: "validation_error:contentType:not_allowed" }, { status: 400 });
    }

    if (file.size > maxUploadSizeForContentType(file.type)) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processAndUpload(
      buffer,
      file.name,
      file.type,
      session.user.id,
    );

    return NextResponse.json({
      publicUrl: result.publicUrl,
      mediaType: result.mediaType,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("POST /api/upload failed:", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
