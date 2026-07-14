import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPosts, createPost, UnauthorizedError, ConflictError } from "@/lib/services/post";
import { createPostSchema, paginationSchema, isTrustedMediaUrl } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { getPersonalChannel, createPersonalChannel } from "@/lib/services/channel";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_CREATED, HTTP_CONFLICT, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";
import { logServerError, logValidationError } from "@/lib/server-log";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit("read-posts", ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      channelId: searchParams.get("channelId") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("GET /api/posts", issue, null);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    if (parsed.data.scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
      }

      const result = await getPosts(parsed.data, session.user.id);
      return NextResponse.json(result);
    }

    const result = await getPosts(parsed.data);
    // Short CDN cache only — no stale serving: a user who deletes or hides a
    // post expects it to disappear immediately, not linger for 2 minutes.
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=30",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
    }
    logServerError("GET /api/posts failed", error);
    return NextResponse.json({ error: "failed_to_fetch_posts" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
  }

  if (!await checkRateLimit("create-post", session.user.id, RATE_LIMITS.createPost.limit, RATE_LIMITS.createPost.windowMs)) {
    return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("POST /api/posts", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const storageDomain = process.env.R2_PUBLIC_URL;
    if (storageDomain) {
      for (const m of parsed.data.media ?? []) {
        if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
          return NextResponse.json(
            { error: `validation_error:media:untrusted_url` },
            { status: HTTP_BAD_REQUEST },
          );
        }
      }
    }

    // Resolve channelId — prefer the one from the request if provided
    const channelId = parsed.data.channelId
      ?? session.user.channelId
      ?? (await getPersonalChannel(session.user.id))?.id
      ?? (await createPersonalChannel(session.user.id, session.user.name || "User")).id;

    const post = await createPost({
      ...parsed.data,
      channelId,
    }, session.user.id);
    return NextResponse.json(post, { status: HTTP_CREATED });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "post_id_collision" }, { status: HTTP_CONFLICT });
    }
    logServerError("POST /api/posts failed", error);
    return NextResponse.json(
      { error: "failed_to_create_post" },
      { status: HTTP_INTERNAL_SERVER_ERROR }
    );
  }
}


