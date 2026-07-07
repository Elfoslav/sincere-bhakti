import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/services/upload";
import { prisma } from "@/lib/prisma";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-log";
import { z } from "zod";

function canonicalizeUrl(url: string): string {
  return url.split("?")[0].split("#")[0];
}

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

    const urls = parsed.data.urls.map(canonicalizeUrl);

    const existing = await prisma.media.findMany({
      where: { url: { in: urls } },
      select: { url: true, userId: true },
    });

    for (const url of urls) {
      const record = existing.find((r) => r.url === url);
      if (record && record.userId !== session.user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    await deleteMediaFiles(parsed.data.urls);
    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("POST /api/upload/cleanup failed", error);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
