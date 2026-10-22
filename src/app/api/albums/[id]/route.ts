import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAlbumById, deleteAlbum, updateAlbum, NotFoundError, ForbiddenError } from "@/lib/services/album";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { isTrustedMediaUrl, updateAlbumSchema } from "@/lib/validation";
import { canAuthorChannel } from "@/lib/services/channel";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_VALIDATION_MEDIA_UNTRUSTED, ERROR_VALIDATION_ALBUM_EMPTY } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST } from "@/lib/error-codes";
import { parseLanguageParam, mutationErrorResponse } from "@/lib/api-helpers";
import type { AlbumMediaInput } from "@/lib/services/album";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readAlbumDetail, ip, RATE_LIMITS.readAlbumDetail.limit, RATE_LIMITS.readAlbumDetail.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { id } = await params;
    const language = parseLanguageParam(request);

    const viewerSession = await auth();
    const album = await getAlbumById(id, language);
    if (!album) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (!album.isPublic) {
      if (!viewerSession?.user?.id || !await canAuthorChannel(album.channel.id, viewerSession.user.id)) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }
    }

    return NextResponse.json(album);
  } catch (error) {
    return serverError("GET /api/albums/[id]", error, "failed_to_fetch_album");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request, RATE_LIMIT_PREFIX.updateAlbum, RATE_LIMITS.updateAlbum, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
    if (authResult.response) return authResult.response;
    const session = authResult.session;

    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(body, updateAlbumSchema, "PATCH /api/albums/[id]");
    if (parsed.response) return parsed.response;

    const { title, description, coverUrl, isPublic, language, media: parsedMedia } = parsed.data;

    // Fail closed: verify every media URL against the storage origin.
    const storageDomain = process.env.R2_PUBLIC_URL ?? "";
    if (parsedMedia !== undefined) {
      for (const m of parsedMedia) {
        if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
          return NextResponse.json({ error: ERROR_VALIDATION_MEDIA_UNTRUSTED }, { status: HTTP_BAD_REQUEST });
        }
      }
    }
    if (coverUrl) {
      if (!isTrustedMediaUrl(coverUrl, "image", storageDomain)) {
        return NextResponse.json({ error: ERROR_VALIDATION_MEDIA_UNTRUSTED }, { status: HTTP_BAD_REQUEST });
      }
    }

    const data: { title?: string; description?: string | null; coverUrl?: string | null; media?: AlbumMediaInput[]; isPublic?: boolean; language?: string } = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (coverUrl !== undefined) data.coverUrl = coverUrl || null;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (language !== undefined) data.language = language;
    if (parsedMedia !== undefined) data.media = parsedMedia;

    const album = await updateAlbum(id, session.user.id, data);
    return NextResponse.json(album);
  } catch (error) {
    const mapped = mutationErrorResponse(error, { empty: ERROR_VALIDATION_ALBUM_EMPTY });
    if (mapped) return mapped;
    return serverError("PATCH /api/albums/[id]", error, "failed_to_update_album");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request, RATE_LIMIT_PREFIX.deleteAlbum, RATE_LIMITS.deleteAlbum, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
    if (authResult.response) return authResult.response;
    const session = authResult.session;

    const { id } = await params;

    await deleteAlbum(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    return serverError("DELETE /api/albums/[id]", error, "failed_to_delete_album");
  }
}
