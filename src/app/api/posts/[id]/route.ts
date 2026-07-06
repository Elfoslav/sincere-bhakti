import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, deletePost, updatePost, NotFoundError, ForbiddenError } from "@/lib/services/post";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { isTrustedMediaUrl } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!post.isPublic) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== post.author.id) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("GET /api/posts/[id] failed:", error);
    return NextResponse.json({ error: "failed_to_fetch_post" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { allowed } = await rateLimit(rateLimitKey("update-post", session.user.id), 30, 3_600_000);
    if (!allowed) {
      return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, isPublic, media } = body;

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json({ error: "validation_error:content:invalid_type" }, { status: 400 });
    }
    if (isPublic !== undefined && typeof isPublic !== "boolean") {
      return NextResponse.json({ error: "validation_error:isPublic:invalid_type" }, { status: 400 });
    }
    if (media !== undefined) {
      if (!Array.isArray(media)) {
        return NextResponse.json({ error: "validation_error:media:invalid_type" }, { status: 400 });
      }
      for (const m of media) {
        if (typeof m.url !== "string" || typeof m.type !== "string") {
          return NextResponse.json({ error: "validation_error:media:invalid_item" }, { status: 400 });
        }
      }

      const storageDomain = process.env.R2_PUBLIC_URL;
      if (storageDomain) {
        for (const m of media) {
          if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
            return NextResponse.json({ error: "validation_error:media:untrusted_url" }, { status: 400 });
          }
        }
      }
    }

    const data: { content?: string | null; isPublic?: boolean; media?: { url: string; type: string }[] } = {};
    if (content !== undefined) data.content = content || null;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (media !== undefined) data.media = media;

    const post = await updatePost(id, session.user.id, data);
    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/posts/[id] failed:", error);
    return NextResponse.json({ error: "failed_to_update_post" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await rateLimit(rateLimitKey("delete-post", session.user.id), 30, 3_600_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429 },
      );
    }

    const { id } = await params;

    await deletePost(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("DELETE /api/posts/[id] failed:", error);
    return NextResponse.json({ error: "failed_to_delete_post" }, { status: 500 });
  }
}
