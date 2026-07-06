import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateNameSchema } from "@/lib/validation";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/csrf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        ...(session?.user?.id === id ? { email: true } : {}),
      },
    });

    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/users/[id] failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id || session.user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { allowed } = await rateLimit(rateLimitKey("update-profile", id), 10, 3_600_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = updateNameSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] || "input";
      return NextResponse.json(
        { error: `validation_error:${String(field)}:${issue.code}` },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/users/[id] failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
