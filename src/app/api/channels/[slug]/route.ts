import { NextRequest, NextResponse } from "next/server";
import { getChannelBySlug } from "@/lib/services/channel";
import { logServerError } from "@/lib/server-log";
import { ERROR_NOT_FOUND, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_NOT_FOUND, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const channel = await getChannelBySlug(slug);

    if (!channel) {
      return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    }

    return NextResponse.json(channel);
  } catch (error) {
    logServerError("GET /api/channels/[slug] failed", error);
    return NextResponse.json({ error: ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
  }
}
