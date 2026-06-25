import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

  if (scope === "public") {
    const authorId = searchParams.get("authorId");

    const posts = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: { isPublic: true, ...(authorId ? { authorId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return NextResponse.json({ posts, hasMore });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await prisma.post.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });
  return NextResponse.json({ posts, hasMore: false });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { content, mediaUrl, mediaType, isPublic } = await request.json();

    if (!content && !mediaUrl) {
      return NextResponse.json(
        { error: "Content or media required" },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrl,
        mediaType,
        isPublic: isPublic ?? true,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
