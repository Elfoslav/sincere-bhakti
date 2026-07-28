import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/services/upload";
import { batchUploadUrlSchema, MAX_TOTAL_UPLOAD_SIZE_BYTES, maxUploadSizeForContentType } from "@/lib/validation";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { getActiveIdentityCookie, setActiveIdentityCookie } from "@/lib/active-identity";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { ERROR_FORBIDDEN, ERROR_UNAUTHORIZED } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_BAD_REQUEST, HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.upload, RATE_LIMITS.upload, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED, skipRateLimit: process.env.NODE_ENV !== "production" });
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, batchUploadUrlSchema, "POST /api/upload-url/batch");
    if (parsed.response) return parsed.response;

    const { postId, files } = parsed.data;
    const resolved = await resolveAuthorableChannelId({
      explicitChannelId: parsed.data.channelId,
      preferredChannelId: getActiveIdentityCookie(request),
      fallbackChannelId: session.user.channelId ?? undefined,
      userId: session.user.id,
    });
    if (resolved.explicitForbidden) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    const channelId = resolved.channelId;

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
      channelId,
      expiresAt: new Date(Date.now() + 3600_000),
    }));
    await prisma.pendingUpload.createMany({ data: pendingData });

    const response = NextResponse.json({ urls: results });
    if (resolved.shouldRefreshPreference && channelId) {
      setActiveIdentityCookie(response, channelId);
    }
    return response;
  } catch (error) {
    return serverError("POST /api/upload-url/batch", error, "failed_to_generate_upload_urls");
  }
}
