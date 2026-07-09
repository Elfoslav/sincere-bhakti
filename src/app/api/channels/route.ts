import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-log";
import { ERROR_NOT_FOUND, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "validation_error:userId:required" }, { status: HTTP_BAD_REQUEST });
    }

    const channel = await prisma.channel.findFirst({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        avatarUrl: true,
        createdAt: true,
        ownerId: true,
        _count: { select: { posts: true } },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    const { _count, ...data } = channel;
    return NextResponse.json({ ...data, postCount: _count.posts });
  } catch (error) {
    logServerError("GET /api/channels failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
