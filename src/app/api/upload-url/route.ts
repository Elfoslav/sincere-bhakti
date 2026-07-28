import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { uploadUrlSchema } from "@/lib/validation";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { resolveAuthorableChannelId } from "@/lib/services/channel";
import { getActiveIdentityCookie, setActiveIdentityCookie } from "@/lib/active-identity";
import { parseBody } from "@/lib/parse-body";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { ERROR_FORBIDDEN, ERROR_UNAUTHORIZED } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RATE_LIMIT_PREFIX.uploadUrl, RATE_LIMITS.uploadUrl, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (auth.response) return auth.response;
  const session = auth.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, uploadUrlSchema, "POST /api/upload-url");
    if (parsed.response) return parsed.response;

    const { fileName, contentType, postId, contentLength } = parsed.data;
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

    const { uploadUrl, publicUrl, key } = await createUploadUrl(
      fileName,
      contentType,
      postId,
      contentLength,
    );

    if (key) {
      await prisma.pendingUpload.create({
        data: {
          key,
          userId: session.user.id,
          channelId,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
    }

    const response = NextResponse.json({
      uploadUrl,
      publicUrl,
      mediaType: contentTypeToMediaType(contentType),
    });
    if (resolved.shouldRefreshPreference && channelId) {
      setActiveIdentityCookie(response, channelId);
    }
    return response;
  } catch (error) {
    return serverError("POST /api/upload-url", error, "failed_to_generate_upload_url");
  }
}
