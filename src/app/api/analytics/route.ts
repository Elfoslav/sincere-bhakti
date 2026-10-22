import { NextRequest, NextResponse } from "next/server";
import { hashAnalyticsKey } from "@/lib/analytics-identity";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMIT_PREFIX, RATE_LIMITS } from "@/lib/rate-limit";
import { analyticsEventSchema, analyticsResourceSchema } from "@/lib/validation";
import { parseBody } from "@/lib/parse-body";
import { getAnalyticsCounts, recordAnalyticsEvent } from "@/lib/services/analytics";
import { NotFoundError } from "@/lib/services/errors";
import { ERROR_FORBIDDEN, ERROR_NOT_FOUND, ERROR_TOO_MANY_REQUESTS, ERROR_VALIDATION_ANALYTICS_BODY } from "@/lib/error-messages";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "@/lib/error-codes";
import { serverError } from "@/lib/error-handlers";

async function handle(request: NextRequest, write: boolean) {
  if (write && !validateOrigin(request)) return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  try {
    const ip = getClientIp(request.headers);
    const key = write ? "writeAnalytics" : "readAnalytics";
    const rateId = hashAnalyticsKey(["rate", new Date().toISOString().slice(0, 10), ip]) ?? "unconfigured";
    if (!await checkRateLimit(RATE_LIMIT_PREFIX[key], rateId, RATE_LIMITS[key].limit, RATE_LIMITS[key].windowMs)) {
      return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
    }
    const query = new URL(request.url).searchParams;
    const resource = parseBody({ resourceType: query.get("resourceType"), resourceId: query.get("resourceId") }, analyticsResourceSchema, "analytics resource");
    if (resource.response) return resource.response;
    if (write) {
      let body: unknown;
      try { body = await request.json(); } catch {
        return NextResponse.json({ error: ERROR_VALIDATION_ANALYTICS_BODY }, { status: HTTP_BAD_REQUEST });
      }
      const parsed = parseBody(body, analyticsEventSchema.omit({ resourceType: true, resourceId: true }), "analytics event");
      if (parsed.response) return parsed.response;
      await recordAnalyticsEvent({ ...resource.data, ...parsed.data }, request.headers, ip);
    }
    return NextResponse.json(await getAnalyticsCounts(resource.data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
    return serverError("analytics", error);
  }
}

export function GET(request: NextRequest) { return handle(request, false); }
export function POST(request: NextRequest) { return handle(request, true); }
