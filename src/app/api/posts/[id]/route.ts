import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, deletePost, updatePost, NotFoundError, ForbiddenError, ValidationError } from "@/lib/services/post";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { isTrustedMediaUrl, updatePostSchema } from "@/lib/validation";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_UNAUTHORIZED, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";
import type { MediaInput } from "@/lib/services/post";
import { logServerError, logValidationError } from "@/lib/server-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await getPostById(id);
    if (!post) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (!post.isPublic) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== post.channel.ownerId) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }
    }

    return NextResponse.json(post);
  } catch (error) {
    logServerError("GET /api/posts/[id] failed", error);
    return NextResponse.json({ error: "failed_to_fetch_post" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
    }

    const { allowed } = await rateLimit(rateLimitKey("update-post", session.user.id), RATE_LIMITS.updatePost.limit, RATE_LIMITS.updatePost.windowMs);
    if (!allowed) {
      console.warn("rate_limited", { route: "update-post", userId: session.user.id });
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      logValidationError("PATCH /api/posts/[id]", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { content, isPublic, media: parsedMedia } = parsed.data;

    if (parsedMedia !== undefined) {
      const storageDomain = process.env.R2_PUBLIC_URL;
      if (storageDomain) {
        for (const m of parsedMedia) {
          if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
            return NextResponse.json({ error: "validation_error:media:untrusted_url" }, { status: HTTP_BAD_REQUEST });
          }
        }
      }
    }

    const data: { content?: string | null; isPublic?: boolean; media?: MediaInput[] } = {};
    if (content !== undefined) data.content = content || null;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (parsedMedia !== undefined) data.media = parsedMedia;

    const post = await updatePost(id, session.user.id, data);
    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "validation_error:post:empty" }, { status: HTTP_BAD_REQUEST });
    }
    logServerError("PATCH /api/posts/[id] failed", error);
    return NextResponse.json({ error: "failed_to_update_post" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_UNAUTHORIZED }, { status: HTTP_UNAUTHORIZED });
    }

    const { allowed } = await rateLimit(rateLimitKey("delete-post", session.user.id), RATE_LIMITS.deletePost.limit, RATE_LIMITS.deletePost.windowMs);
    if (!allowed) {
      console.warn("rate_limited", { route: "delete-post", userId: session.user.id });
      return NextResponse.json(
        { error: ERROR_TOO_MANY_REQUESTS },
        { status: HTTP_TOO_MANY_REQUESTS },
      );
    }

    const { id } = await params;

    await deletePost(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    logServerError("DELETE /api/posts/[id] failed", error);
    return NextResponse.json({ error: "failed_to_delete_post" }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
