import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPosts, createPost, UnauthorizedError } from "@/lib/services/post";
import { createPostSchema, paginationSchema } from "@/lib/validation";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

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
      const issue = parsed.error.issues[0];
      const field = issue.path[0] || "input";
      return NextResponse.json(
        { error: `validation_error:${String(field)}:${issue.code}` },
        { status: 400 }
      );
    }

    if (parsed.data.scope !== "public") {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await getPosts(parsed.data, session.user.id);
      return NextResponse.json(result);
    }

    const result = await getPosts(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/posts failed:", error);
    return NextResponse.json({ error: "failed_to_fetch_posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await rateLimit(rateLimitKey("create-post", session.user.id), 20, 3_600_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] || "input";
      return NextResponse.json(
        { error: `validation_error:${String(field)}:${issue.code}` },
        { status: 400 }
      );
    }

    const post = await createPost(parsed.data, session.user.id);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts failed:", error);
    return NextResponse.json(
      { error: "failed_to_create_post" },
      { status: 500 }
    );
  }
}
