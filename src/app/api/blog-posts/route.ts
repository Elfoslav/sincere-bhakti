import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBlogPosts, createBlogPost, UnauthorizedError } from "@/lib/services/blog";
import { createBlogPostSchema, blogPaginationSchema, isTrustedMediaUrl } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { requireVerifiedUser, resolveWriteChannel, ensurePersonalChannel, applyIdentityPreference, mutationErrorResponse } from "@/lib/api-helpers";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS, ERROR_BLOG_ID_COLLISION, ERROR_VALIDATION_COVER_UNTRUSTED, ERROR_VALIDATION_BLOG_EMPTY } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_CREATED } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseBody({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      channelId: searchParams.get("channelId") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    }, blogPaginationSchema, "GET /api/blog-posts");
    if (parsed.response) return parsed.response;

    if (parsed.data.scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
      }

      const result = await getBlogPosts({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" }, session.user.id);
      return NextResponse.json(result);
    }

    const result = await getBlogPosts({ ...parsed.data, requestLanguage: parsed.data.language ?? "en" });
    return NextResponse.json(result);
  } catch (error) {
    // Private-scope requests for a channel the caller may not access throw
    // UnauthorizedError — the route already guarantees authentication, so
    // this is a forbidden access, not a server failure (never a 500).
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    return serverError("GET /api/blog-posts", error, "failed_to_fetch_blog_posts");
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireVerifiedUser(request, RATE_LIMIT_PREFIX.createBlog, RATE_LIMITS.createBlog, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  try {
    const body = await request.json();
    const parsed = parseBody(body, createBlogPostSchema, "POST /api/blog-posts");
    if (parsed.response) return parsed.response;

    // Fail closed: covers must come from the app's own storage (R2). Without a
    // configured storage origin nothing is trusted — same rule as post media.
    if (parsed.data.coverUrl) {
      const storageDomain = process.env.R2_PUBLIC_URL ?? "";
      if (!isTrustedMediaUrl(parsed.data.coverUrl, "image", storageDomain)) {
        return NextResponse.json(
          { error: ERROR_VALIDATION_COVER_UNTRUSTED },
          { status: HTTP_BAD_REQUEST },
        );
      }
    }

    const channel = await resolveWriteChannel(request, session, parsed.data.channelId);
    if (channel.response) return channel.response;
    const channelId = await ensurePersonalChannel(session, channel.channelId);

    const post = await createBlogPost({
      ...parsed.data,
      channelId,
    }, session.user.id, parsed.data.language);
    const response = NextResponse.json(post, { status: HTTP_CREATED });
    applyIdentityPreference(response, channelId, channel.refreshPreference);
    return response;
  } catch (error) {
    const mapped = mutationErrorResponse(error, { empty: ERROR_VALIDATION_BLOG_EMPTY, conflict: ERROR_BLOG_ID_COLLISION });
    if (mapped) return mapped;
    return serverError("POST /api/blog-posts", error, "failed_to_create_blog_post");
  }
}
