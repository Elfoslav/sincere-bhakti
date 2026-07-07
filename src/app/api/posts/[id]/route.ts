import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, deletePost, updatePost, NotFoundError, ForbiddenError } from "@/lib/services/post";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { isTrustedMediaUrl, updatePostSchema } from "@/lib/validation";
import type { MediaInput } from "@/lib/services/post";

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
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] || "input";
      return NextResponse.json(
        { error: `validation_error:${String(field)}:${issue.code}` },
        { status: 400 }
      );
    }

    const { content, isPublic, media: parsedMedia } = parsed.data;

    if (parsedMedia !== undefined) {
      const storageDomain = process.env.R2_PUBLIC_URL;
      if (storageDomain) {
        for (const m of parsedMedia) {
          if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
            return NextResponse.json({ error: "validation_error:media:untrusted_url" }, { status: 400 });
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
