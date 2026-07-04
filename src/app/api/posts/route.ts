import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPosts, createPost, UnauthorizedError } from "@/lib/services/post";
import { createPostSchema, paginationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      authorId: searchParams.get("authorId") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { scope, cursor, limit, authorId, language } = parsed.data;

    if (scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await getPosts({ scope, cursor, limit, authorId, language }, session.user.id);
      return NextResponse.json(result);
    }

    const result = await getPosts({ scope, cursor, limit, authorId, language });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/posts failed:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const post = await createPost(parsed.data, session.user.id);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts failed:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
