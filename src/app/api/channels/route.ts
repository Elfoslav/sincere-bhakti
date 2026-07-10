import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-log";
import { normalizeName } from "@/lib/validation";
import { ERROR_NOT_FOUND, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_NOT_FOUND, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
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
    }

    const cursor = searchParams.get("cursor");
    const query = searchParams.get("q")?.trim();

    const normalizedQuery = query ? normalizeName(query) : "";

    const where = query
      ? { normalizedName: { contains: normalizedQuery, mode: "insensitive" as const } }
      : {};

    const channels = await prisma.channel.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        avatarUrl: true,
        createdAt: true,
        ownerId: true,
        _count: { select: { posts: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const items = channels.map(({ _count, ...data }) => ({
      ...data,
      postCount: _count.posts,
    }));

    return NextResponse.json({
      items,
      nextCursor: channels.length === 20 ? channels[channels.length - 1].id : null,
    });
  } catch (error) {
    logServerError("GET /api/channels failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}