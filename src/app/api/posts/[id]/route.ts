import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, deletePost, updatePost, NotFoundError, ForbiddenError, ValidationError } from "@/lib/services/post";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { isTrustedMediaUrl, updatePostSchema } from "@/lib/validation";
import { canAuthorChannel } from "@/lib/services/channel";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST } from "@/lib/error-codes";
import type { MediaInput } from "@/lib/services/post";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPostDetail, ip, RATE_LIMITS.readPostDetail.limit, RATE_LIMITS.readPostDetail.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { id } = await params;
    const language = new URL(request.url).searchParams.get("language") ?? "en";

    const post = await getPostById(id, language);
    if (!post) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (!post.isPublic) {
      const session = await auth();
      if (!session?.user?.id || !await canAuthorChannel(post.channel.id, session.user.id)) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }
    }

    return NextResponse.json(post);
  } catch (error) {
    return serverError("GET /api/posts/[id]", error, "failed_to_fetch_post");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request, RATE_LIMIT_PREFIX.updatePost, RATE_LIMITS.updatePost, { authErrorCode: "unauthorized", authErrorStatus: 401 });
    if (auth.response) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(body, updatePostSchema, "PATCH /api/posts/[id]");
    if (parsed.response) return parsed.response;

    const { content, isPublic, language, media: parsedMedia } = parsed.data;

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

    const data: { content?: string | null; isPublic?: boolean; media?: MediaInput[]; language?: string } = {};
    if (content !== undefined) data.content = content || null;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (language !== undefined) data.language = language;
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
    return serverError("PATCH /api/posts/[id]", error, "failed_to_update_post");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request, RATE_LIMIT_PREFIX.deletePost, RATE_LIMITS.deletePost, { authErrorCode: "unauthorized", authErrorStatus: 401 });
    if (auth.response) return auth.response;
    const session = auth.session;

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
    return serverError("DELETE /api/posts/[id]", error, "failed_to_delete_post");
  }
}
