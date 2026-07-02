import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, deletePost, NotFoundError, ForbiddenError } from "@/lib/services/post";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await getPostById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.isPublic) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== post.author.id) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("GET /api/posts/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await deletePost(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("DELETE /api/posts/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
