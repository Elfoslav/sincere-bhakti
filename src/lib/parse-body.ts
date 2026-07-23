import { NextResponse } from "next/server";
import type { z } from "zod";
import { logValidationError } from "@/lib/server-log";
import { HTTP_BAD_REQUEST } from "@/lib/error-codes";

export function parseBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>,
  routeName: string,
): { data: T; response?: undefined } | { data?: undefined; response: NextResponse } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    logValidationError(routeName, issue, body);
    return {
      response: NextResponse.json(
        { error: `validation_error:${issue.path.join(".")}:${issue.code}` },
        { status: HTTP_BAD_REQUEST },
      ),
    };
  }
  return { data: parsed.data };
}
