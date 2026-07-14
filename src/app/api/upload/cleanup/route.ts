import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteMediaFiles, extractKey } from "@/lib/services/upload";
import { prisma } from "@/lib/prisma";
import { canonicalizeUrl } from "@/lib/url";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-log";
import { isSafeHttpUrl } from "@/lib/validation";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";
import { z } from "zod";

const cleanupSchema = z.object({
  urls: z.array(z.string().url().refine(isSafeHttpUrl)).max(100),
});

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

  // Tidy expired PendingUpload rows (1h TTL) so the table doesn't grow unboundedly.
  await prisma.pendingUpload.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((err) => logServerError("PendingUpload cleanup failed", err));

  try {
    const body = await request.json();
    const parsed = cleanupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error:urls:invalid" }, { status: HTTP_BAD_REQUEST });
    }

    const urls = parsed.data.urls.map(canonicalizeUrl);

    const existing = await prisma.media.findMany({
      where: { url: { in: urls } },
      select: { url: true, userId: true },
    });

    for (const url of urls) {
      const record = existing.find((r) => r.url === url);
      if (record && record.userId !== session.user.id) {
        return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
      }
    }

    // Only delete URLs that have NO Media record — URLs with an existing row
    // are still referenced by a post and must not be removed.
    const existingUrls = new Set(existing.map((r) => r.url));
    const abandoned = urls.filter((u) => !existingUrls.has(u));

    if (abandoned.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Verify ownership of abandoned URLs via PendingUpload records.
    // Only block when a PendingUpload record exists but belongs to someone else.
    // No PendingUpload record = legacy orphaned file, allow deletion.
    const storageDomain = process.env.R2_PUBLIC_URL;
    const storageKeys = abandoned
      .map((u) => (storageDomain ? extractKey(u, storageDomain) : null))
      .filter((k): k is string => k !== null);
    if (storageKeys.length > 0) {
      const pendingRecords = await prisma.pendingUpload.findMany({
        where: { key: { in: storageKeys } },
        select: { key: true, userId: true },
      });
      const ownerByKey = new Map(pendingRecords.map((r) => [r.key, r.userId]));
      for (const key of storageKeys) {
        const owner = ownerByKey.get(key);
        if (owner && owner !== session.user.id) {
          return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
        }
      }
    }

    await deleteMediaFiles(abandoned);

    // Remove PendingUpload records for deleted files
    if (storageKeys.length > 0) {
      await prisma.pendingUpload.deleteMany({ where: { key: { in: storageKeys } } });
    }

    return NextResponse.json({ success: true, deleted: abandoned.length });
  } catch (error) {
    logServerError("POST /api/upload/cleanup failed", error);
    return NextResponse.json({ error: "cleanup_failed" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
