import { NextRequest, NextResponse } from "next/server";
import { searchCategories, resolveCategoryIds } from "@/lib/services/category";
import { categorySearchSchema, createCategorySchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { ERROR_TOO_MANY_REQUESTS, ERROR_FORBIDDEN } from "@/lib/error-messages";
import { HTTP_TOO_MANY_REQUESTS, HTTP_FORBIDDEN, HTTP_CREATED } from "@/lib/error-codes";
import { requireAuth } from "@/lib/require-auth";
import { serverError } from "@/lib/error-handlers";
import { parseBody } from "@/lib/parse-body";
import { prisma } from "@/lib/prisma";
import { validateOrigin } from "@/lib/csrf";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!await checkRateLimit(RATE_LIMIT_PREFIX.searchCategories, ip, RATE_LIMITS.searchCategories.limit, RATE_LIMITS.searchCategories.windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseBody({
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    }, categorySearchSchema, "GET /api/categories");
    if (parsed.response) return parsed.response;

    const categories = await searchCategories(parsed.data);
    return NextResponse.json({ categories });
  } catch (error) {
    return serverError("GET /api/categories", error, "failed_to_fetch_categories");
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, RATE_LIMIT_PREFIX.createCategory, RATE_LIMITS.createCategory, { authErrorCode: "unauthorized", authErrorStatus: 401 });
  if (authResult.response) return authResult.response;
  const session = authResult.session;

  if (!session.user.emailVerifiedAt) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  if (!validateOrigin(request)) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body, createCategorySchema, "POST /api/categories");
    if (parsed.response) return parsed.response;

    // Get-or-create within the requested language: concurrent creators of
    // the same name converge on one row via the atomic upsert (no advisory
    // lock needed — single composite unique key). Names arrive canonicalized
    // by the Zod transform.
    const [id] = await resolveCategoryIds(prisma, [parsed.data.name], parsed.data.language);
    const category = await prisma.category.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, slug: true, language: true },
    });
    return NextResponse.json(category, { status: HTTP_CREATED });
  } catch (error) {
    return serverError("POST /api/categories", error, "failed_to_create_category");
  }
}
