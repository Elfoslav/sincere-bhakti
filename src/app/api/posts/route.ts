import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPosts, createPost, UnauthorizedError } from "@/lib/services/post";
import { createPostSchema, paginationSchema, isTrustedMediaUrl } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireVerifiedUser, resolveWriteChannel, ensurePersonalChannel, applyIdentityPreference, mutationErrorResponse } from "@/lib/api-helpers";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_POST_ID_COLLISION, ERROR_VALIDATION_MEDIA_UNTRUSTED, ERROR_VALIDATION_POST_EMPTY } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_CREATED } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseBody({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      channelId: searchParams.get("channelId") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      blogPostId: searchParams.get("blogPostId") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    }, paginationSchema, "GET /api/posts");
    if (parsed.response) return parsed.response;

    if (parsed.data.scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
      }

      const result = await getPosts({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" }, session.user.id);
      return NextResponse.json(result);
    }

    // Public scope stays open, but the viewer (when logged in) determines
    // whether a linked private/scheduled article is included — anonymous
    // callers get blogPost: null for non-public articles.
    const session = await auth();
    const result = await getPosts({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" }, session?.user?.id);
    return NextResponse.json(result);
  } catch (error) {
    // Same shape as GET /api/blog-posts: an authenticated caller without
    // access to the requested private scope is forbidden, not a 500.
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    return serverError("GET /api/posts", error, "failed_to_fetch_posts");
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireVerifiedUser(request, RATE_LIMIT_PREFIX.createPost, RATE_LIMITS.createPost, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, createPostSchema, "POST /api/posts");
    if (parsed.response) return parsed.response;

    // Enforce media trust unconditionally (fail closed). isTrustedMediaUrl
    // requires a valid storage origin for image/video/file and validates youtube
    // independently — so if R2_PUBLIC_URL is unset, storage-hosted media can't be
    // verified and is rejected rather than trusted.
    const storageDomain = process.env.R2_PUBLIC_URL ?? "";
    for (const m of parsed.data.media ?? []) {
      if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
        return NextResponse.json(
          { error: ERROR_VALIDATION_MEDIA_UNTRUSTED },
          { status: HTTP_BAD_REQUEST },
        );
      }
    }

    const channel = await resolveWriteChannel(request, session, parsed.data.channelId);
    if (channel.response) return channel.response;
    const channelId = await ensurePersonalChannel(session, channel.channelId);

    const post = await createPost({
      ...parsed.data,
      channelId,
    }, session.user.id, parsed.data.language);
    const response = NextResponse.json(post, { status: HTTP_CREATED });
    applyIdentityPreference(response, channelId, channel.refreshPreference);
    return response;
  } catch (error) {
    const mapped = mutationErrorResponse(error, { empty: ERROR_VALIDATION_POST_EMPTY, conflict: ERROR_POST_ID_COLLISION });
    if (mapped) return mapped;
    return serverError("POST /api/posts", error, "failed_to_create_post");
  }
}
