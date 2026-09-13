import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl, contentTypeToMediaType } from "@/lib/services/upload";
import { uploadUrlSchema } from "@/lib/validation";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/parse-body";
import { requireVerifiedUser, resolveWriteChannel, applyIdentityPreference } from "@/lib/api-helpers";
import { serverError } from "@/lib/error-handlers";
import { ERROR_UNAUTHORIZED } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const authResult = await requireVerifiedUser(request, RATE_LIMIT_PREFIX.uploadUrl, RATE_LIMITS.uploadUrl, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, uploadUrlSchema, "POST /api/upload-url");
    if (parsed.response) return parsed.response;

    const { fileName, contentType, postId, contentLength } = parsed.data;
    const channel = await resolveWriteChannel(request, session, parsed.data.channelId);
    if (channel.response) return channel.response;
    const channelId = channel.channelId;

    const { uploadUrl, publicUrl, key } = await createUploadUrl(
      fileName,
      contentType,
      postId,
      contentLength,
      parsed.data.folder,
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
    applyIdentityPreference(response, channelId, channel.refreshPreference);
    return response;
  } catch (error) {
    return serverError("POST /api/upload-url", error, "failed_to_generate_upload_url");
  }
}
