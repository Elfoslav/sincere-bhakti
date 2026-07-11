import { NextRequest, NextResponse } from "next/server";
import { getChannelBySlug } from "@/lib/services/channel";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-log";
import { ERROR_NOT_FOUND, ERROR_SERVER_ERROR, ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = await rateLimit(rateLimitKey("read-channel", ip), RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs);
    if (!allowed) {
      console.warn("rate_limited", { route: "read-channel", ip });
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
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
