import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAlbums, createAlbum, UnauthorizedError } from "@/lib/services/album";
import { createAlbumSchema, albumPaginationSchema, isTrustedMediaUrl } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireVerifiedUser, resolveWriteChannel, ensurePersonalChannel, applyIdentityPreference, mutationErrorResponse } from "@/lib/api-helpers";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_ALBUM_ID_COLLISION, ERROR_VALIDATION_MEDIA_UNTRUSTED, ERROR_VALIDATION_ALBUM_EMPTY } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_CREATED } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readAlbums, ip, RATE_LIMITS.readAlbums.limit, RATE_LIMITS.readAlbums.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseBody({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      channelId: searchParams.get("channelId") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    }, albumPaginationSchema, "GET /api/albums");
    if (parsed.response) return parsed.response;

    // Non-public scopes require auth; public stays open (viewer determines
    // private visibility, same as posts).
    if (parsed.data.scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
      }
      const result = await getAlbums({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" }, session.user.id);
      return NextResponse.json(result);
    }

    const session = await auth();
    const result = await getAlbums({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" }, session?.user?.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    return serverError("GET /api/albums", error, "failed_to_fetch_albums");
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireVerifiedUser(request, RATE_LIMIT_PREFIX.createAlbum, RATE_LIMITS.createAlbum, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, createAlbumSchema, "POST /api/albums");
    if (parsed.response) return parsed.response;

    // Gallery items are R2-hosted photos/videos (or youtube embeds via the
    // shared media schema). Enforce the trust boundary unconditionally —
    // fail closed when the storage origin is unset.
    const storageDomain = process.env.R2_PUBLIC_URL ?? "";
    for (const m of parsed.data.media ?? []) {
      if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
        return NextResponse.json(
          { error: ERROR_VALIDATION_MEDIA_UNTRUSTED },
          { status: HTTP_BAD_REQUEST },
        );
      }
    }
    if (parsed.data.coverUrl && !isTrustedMediaUrl(parsed.data.coverUrl, "image", storageDomain)) {
      return NextResponse.json(
        { error: ERROR_VALIDATION_MEDIA_UNTRUSTED },
        { status: HTTP_BAD_REQUEST },
      );
    }

    const channel = await resolveWriteChannel(request, session, parsed.data.channelId);
    if (channel.response) return channel.response;
    const channelId = await ensurePersonalChannel(session, channel.channelId);

    const album = await createAlbum({
      ...parsed.data,
      channelId,
    }, session.user.id, parsed.data.language);
    const response = NextResponse.json(album, { status: HTTP_CREATED });
    applyIdentityPreference(response, channelId, channel.refreshPreference);
    return response;
  } catch (error) {
    const mapped = mutationErrorResponse(error, { empty: ERROR_VALIDATION_ALBUM_EMPTY, conflict: ERROR_ALBUM_ID_COLLISION });
    if (mapped) return mapped;
    return serverError("POST /api/albums", error, "failed_to_create_album");
  }
}
