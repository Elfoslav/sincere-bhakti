import { NextResponse } from "next/server";
import { logServerError } from "@/lib/server-log";
import { ERROR_NAME_TAKEN, ERROR_SERVER_ERROR } from "@/lib/error-messages";
import { HTTP_CONFLICT, HTTP_INTERNAL_SERVER_ERROR } from "@/lib/error-codes";

export function handlePrismaCollision(error: unknown, routeName: string): NextResponse | null {
  if ((error as { code?: string })?.code === "P2002") {
    logServerError(`${routeName} P2002 collision`, error);
    return NextResponse.json({ error: ERROR_NAME_TAKEN }, { status: HTTP_CONFLICT });
  }
  return null;
}

export function serverError(routeName: string, error: unknown, message?: string): NextResponse {
  logServerError(`${routeName} failed`, error);
  return NextResponse.json({ error: message ?? ERROR_SERVER_ERROR }, { status: HTTP_INTERNAL_SERVER_ERROR });
}
