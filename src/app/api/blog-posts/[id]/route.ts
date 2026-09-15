import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBlogPostById, deleteBlogPost, updateBlogPost, isBlogPubliclyVisible, NotFoundError, ForbiddenError } from "@/lib/services/blog";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { updateBlogPostSchema, isSafeHttpUrl, isTrustedMediaUrl } from "@/lib/validation";
import { canAuthorChannel } from "@/lib/services/channel";
import { ERROR_UNAUTHORIZED, ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_VALIDATION_COVER_INVALID, ERROR_VALIDATION_COVER_UNTRUSTED, ERROR_VALIDATION_BLOG_EMPTY } from "@/lib/error-messages";
import { HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_BAD_REQUEST } from "@/lib/error-codes";
import { parseLanguageParam, mutationErrorResponse } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogDetail, ip, RATE_LIMITS.readBlogDetail.limit, RATE_LIMITS.readBlogDetail.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { id } = await params;
    const language = parseLanguageParam(request);

    const post = await getBlogPostById(id, language);
    if (!post) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    if (!isBlogPubliclyVisible(post)) {
      const session = await auth();
      if (!session?.user?.id || !await canAuthorChannel(post.channel.id, session.user.id)) {
        return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
      }
    }

    return NextResponse.json(post);
  } catch (error) {
    return serverError("GET /api/blog-posts/[id]", error, "failed_to_fetch_blog_post");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request, RATE_LIMIT_PREFIX.updateBlog, RATE_LIMITS.updateBlog, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
    if (authResult.response) return authResult.response;
    const session = authResult.session;

    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(body, updateBlogPostSchema, "PATCH /api/blog-posts/[id]");
    if (parsed.response) return parsed.response;

    const { title, slug, excerpt, content, coverUrl, contentHtml, isPublic, language, publishedAt, categories } = parsed.data;

    if (coverUrl !== undefined && coverUrl !== null && !isSafeHttpUrl(coverUrl)) {
      return NextResponse.json({ error: ERROR_VALIDATION_COVER_INVALID }, { status: HTTP_BAD_REQUEST });
    }
    if (coverUrl) {
      const storageDomain = process.env.R2_PUBLIC_URL ?? "";
      if (!isTrustedMediaUrl(coverUrl, "image", storageDomain)) {
        return NextResponse.json({ error: ERROR_VALIDATION_COVER_UNTRUSTED }, { status: HTTP_BAD_REQUEST });
      }
    }

    const data: { title?: string; slug?: string | null; excerpt?: string | null; content?: string | null; coverUrl?: string | null; contentHtml?: string | null; isPublic?: boolean; language?: string; publishedAt?: Date | null; categories?: string[] | null } = {};
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = slug;
    if (excerpt !== undefined) data.excerpt = excerpt || null;
    if (content !== undefined) data.content = content || null;
    if (coverUrl !== undefined) data.coverUrl = coverUrl || null;
    if (contentHtml !== undefined) data.contentHtml = contentHtml || null;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (language !== undefined) data.language = language;
    if (publishedAt !== undefined) data.publishedAt = publishedAt;
    if (categories !== undefined) data.categories = categories;

    const post = await updateBlogPost(id, session.user.id, data);
    return NextResponse.json(post);
  } catch (error) {
    const mapped = mutationErrorResponse(error, { empty: ERROR_VALIDATION_BLOG_EMPTY });
    if (mapped) return mapped;
    return serverError("PATCH /api/blog-posts/[id]", error, "failed_to_update_blog_post");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request, RATE_LIMIT_PREFIX.deleteBlog, RATE_LIMITS.deleteBlog, { authErrorCode: ERROR_UNAUTHORIZED, authErrorStatus: HTTP_UNAUTHORIZED });
    if (authResult.response) return authResult.response;
    const session = authResult.session;

    const { id } = await params;

    await deleteBlogPost(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
    }
    return serverError("DELETE /api/blog-posts/[id]", error, "failed_to_delete_blog_post");
  }
}
