import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { uploadUrlSchema } from "@/lib/validation";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, resetIn } = rateLimit(rateLimitKey("upload-url", session.user.id), 20, 3_600_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${Math.ceil(resetIn / 60_000)} minutes.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const parsed = uploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
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
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
