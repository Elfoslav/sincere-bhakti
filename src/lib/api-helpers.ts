import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getActiveIdentityCookie, setActiveIdentityCookie } from "@/lib/active-identity";
import {
  resolveAuthorableChannelId,
  getPersonalChannel,
  createPersonalChannel,
} from "@/lib/services/channel";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@/lib/services/errors";
import {
  ERROR_EMAIL_NOT_VERIFIED,
  ERROR_FORBIDDEN,
  ERROR_NOT_FOUND,
} from "@/lib/error-messages";
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
} from "@/lib/error-codes";
import { locales } from "@/i18n/routing";
import type { SessionUser } from "@/types/auth";

// Shared building blocks for API routes. Mutation routes repeat the same
// preamble (CSRF + auth + rate limit, verified-email gate, authorable-channel
// resolution, service-error mapping) and the same locale query parsing —
// implement once here so the next route copies a call, not a block.

/** `?language=` normalized to a supported locale (defaults to "en"). */
export function parseLanguageParam(request: NextRequest, param = "language"): string {
  const raw = new URL(request.url).searchParams.get(param) ?? "en";
  return (locales as readonly string[]).includes(raw) ? raw : "en";
}

type VerifiedAuthResult =
  | { session: SessionUser; response: undefined }
  | { session: undefined; response: NextResponse };

/**
 * `requireAuth` plus the verified-email gate every creation path enforces
 * (unverified accounts may not claim names, upload files, or publish).
 */
export async function requireVerifiedUser(
  request: NextRequest,
  rateLimitPrefix: string,
  rateLimit: { limit: number; windowMs: number },
  opts?: { authErrorCode?: string; authErrorStatus?: number; skipRateLimit?: boolean },
): Promise<VerifiedAuthResult> {
  const authResult = await requireAuth(request, rateLimitPrefix, rateLimit, opts);
  if (authResult.response) return authResult;
  if (!authResult.session.user.emailVerifiedAt) {
    return {
      session: undefined,
      response: NextResponse.json({ error: ERROR_EMAIL_NOT_VERIFIED }, { status: HTTP_FORBIDDEN }),
    };
  }
  return authResult;
}

export type ResolvedWriteChannel =
  | { response: NextResponse; channelId?: undefined; refreshPreference?: undefined }
  | { response?: undefined; channelId: string | undefined; refreshPreference: boolean };

/**
 * Resolve the channel a write acts as: explicit `channelId` (when the caller
 * may author it) → active-identity cookie → session default. Returns a 403
 * response for forbidden explicit channels instead of throwing.
 */
export async function resolveWriteChannel(
  request: NextRequest,
  session: SessionUser,
  explicitChannelId?: string,
): Promise<ResolvedWriteChannel> {
  const resolved = await resolveAuthorableChannelId({
    explicitChannelId,
    preferredChannelId: getActiveIdentityCookie(request),
    fallbackChannelId: session.user.channelId ?? undefined,
    userId: session.user.id,
  });
  if (resolved.explicitForbidden) {
    return {
      response: NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN }),
    };
  }
  return { channelId: resolved.channelId, refreshPreference: resolved.shouldRefreshPreference };
}

/**
 * Ensure a concrete channel id, creating the caller's personal channel as a
 * last resort (post/blog creation must never fail for lack of a channel).
 */
export async function ensurePersonalChannel(session: SessionUser, channelId?: string): Promise<string> {
  return (
    channelId ??
    (await getPersonalChannel(session.user.id))?.id ??
    (await createPersonalChannel(session.user.id, session.user.name || "User")).id
  );
}

/** Persist the active-identity cookie when the resolver refreshed it. */
export function applyIdentityPreference(
  response: NextResponse,
  channelId: string | undefined,
  refreshPreference: boolean,
): void {
  if (refreshPreference && channelId) setActiveIdentityCookie(response, channelId);
}

/**
 * Map the shared service errors to responses. Returns null when the error is
 * none of them so the caller falls through to `serverError`. `conflict` is
 * optional — update/delete routes that can't collide omit it.
 */
export function mutationErrorResponse(
  error: unknown,
  codes: { empty: string; conflict?: string },
): NextResponse | null {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: ERROR_NOT_FOUND }, { status: HTTP_NOT_FOUND });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: HTTP_FORBIDDEN });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: codes.empty }, { status: HTTP_BAD_REQUEST });
  }
  if (error instanceof ConflictError && codes.conflict) {
    return NextResponse.json({ error: codes.conflict }, { status: HTTP_CONFLICT });
  }
  return null;
}
