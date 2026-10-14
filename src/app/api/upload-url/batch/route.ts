import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/services/upload";
import { batchUploadUrlSchema, MAX_TOTAL_UPLOAD_SIZE_BYTES, MAX_GALLERY_BATCH_SIZE_BYTES, MAX_MEDIA_ITEMS_PER_POST, maxUploadSizeForContentType } from "@/lib/validation";
import { RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/parse-body";
import { requireVerifiedUser, resolveWriteChannel, applyIdentityPreference } from "@/lib/api-helpers";
import { serverError } from "@/lib/error-handlers";
import { ERROR_UNAUTHORIZED } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_UNAUTHORIZED } from "@/lib/error-codes";

export async function POST(request: NextRequest) {
  const authResult = await requireVerifiedUser(request, RATE_LIMIT_PREFIX.upload, RATE_LIMITS.upload, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED, skipRateLimit: process.env.NODE_ENV !== "production" });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, batchUploadUrlSchema, "POST /api/upload-url/batch");
    if (parsed.response) return parsed.response;

    const { postId, files } = parsed.data;
    const channel = await resolveWriteChannel(request, session, parsed.data.channelId);
    if (channel.response) return channel.response;
    const channelId = channel.channelId;

    // Gallery batches allow up to 50 files / 2 GB per request so a whole
    // shoot goes in one go; posts/blog stay at 10 files / 500 MB (feed
    // cards render at most MAX_MEDIA_ITEMS_PER_POST items anyway).
    const isGallery = parsed.data.folder === "gallery";
    if (!isGallery && files.length > MAX_MEDIA_ITEMS_PER_POST) {
      return NextResponse.json(
        { error: "validation_error:files:too_many" },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const batchCap = isGallery ? MAX_GALLERY_BATCH_SIZE_BYTES : MAX_TOTAL_UPLOAD_SIZE_BYTES;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > batchCap) {
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
      files.map((f) => createUploadUrl(f.fileName, f.contentType, postId, f.size, parsed.data.folder)),
    );

    const pendingData = results.map((r) => ({
      key: r.key,
      userId: session.user.id,
      channelId,
      expiresAt: new Date(Date.now() + 3600_000),
    }));
    await prisma.pendingUpload.createMany({ data: pendingData });

    const response = NextResponse.json({ urls: results });
    applyIdentityPreference(response, channelId, channel.refreshPreference);
    return response;
  } catch (error) {
    return serverError("POST /api/upload-url/batch", error, "failed_to_generate_upload_urls");
  }
}
