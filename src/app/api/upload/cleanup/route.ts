import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/services/upload";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const cleanupSchema = z.object({
  urls: z.array(z.string().url()).max(100),
});

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
    const parsed = cleanupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error:urls:invalid" }, { status: 400 });
    }

    await deleteMediaFiles(parsed.data.urls);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/upload/cleanup failed:", error);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
