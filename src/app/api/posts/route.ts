import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPosts, createPost, UnauthorizedError } from "@/lib/services/post";
import { createPostSchema, paginationSchema, isTrustedMediaUrl } from "@/lib/validation";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";
import { logServerError, logValidationError } from "@/lib/server-log";

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
      logValidationError("GET /api/posts", issue, null);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
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
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    logServerError("GET /api/posts failed", error);
    return NextResponse.json({ error: "failed_to_fetch_posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { allowed } = await rateLimit(rateLimitKey("create-post", session.user.id), RATE_LIMITS.createPost.limit, RATE_LIMITS.createPost.windowMs);
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
      logValidationError("POST /api/posts", issue, body);
      return NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: 400 }
      );
    }

    const storageDomain = process.env.R2_PUBLIC_URL;
    if (storageDomain) {
      for (const m of parsed.data.media ?? []) {
        if (!isTrustedMediaUrl(m.url, m.type, storageDomain)) {
          return NextResponse.json(
            { error: `validation_error:media:untrusted_url` },
            { status: 400 },
          );
        }
      }
    }

    const post = await createPost(parsed.data, session.user.id);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    logServerError("POST /api/posts failed", error);
    return NextResponse.json(
      { error: "failed_to_create_post" },
      { status: 500 }
    );
  }
}
