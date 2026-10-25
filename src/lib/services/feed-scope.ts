import { prisma } from "@/lib/prisma";
import { isChannelEditor } from "@/lib/services/channel";
import { CHANNEL_AUTHOR_ROLES } from "@/lib/channel-roles";
import { NotFoundError, UnauthorizedError } from "@/lib/services/errors";
import { FEED_SEARCH_MAX_TERMS } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

// Timeline posts, blog articles, and albums filter the same
// channel/visibility shape (channel ownership, editor roles, public vs
// private scope). It used to be copy-pasted in both services — including a
// byte-for-byte duplicate visibility filter — so a fix applied to one copy
// silently missed the other. The intersection keeps both callers type-safe:
// the object only sets shared keys, except publication dates which callers
// without scheduling disable through supportsScheduling.
export type FeedScopeWhere = Prisma.PostWhereInput & Prisma.BlogPostWhereInput;

export interface FeedScopeParams {
  scope?: "public" | "private";
  channelId?: string;
  currentUserId?: string;
  /** Albums have visibility flags but no scheduled publication date. */
  supportsScheduling?: boolean;
}

export function publicVisibilityFilter(now: Date, supportsScheduling = true): FeedScopeWhere {
  if (!supportsScheduling) return { isPublic: true };
  return {
    isPublic: true,
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

/**
 * Resolve the scope/visibility portion of a feed `where` clause. Callers
 * apply their own filters (language, category, blogPostId) first, then
 * `Object.assign` this result — the keys never overlap.
 */
export async function resolveFeedScopeWhere(
  params: FeedScopeParams,
  now: Date = new Date(),
): Promise<FeedScopeWhere> {
  const { scope, channelId, currentUserId, supportsScheduling = true } = params;
  const where: FeedScopeWhere = {};

  if (scope === "public") {
    // Public feeds show only immediately visible rows: flagged public with
    // no (or a past) publish date. Scheduled rows stay out until go-live.
    Object.assign(where, publicVisibilityFilter(now, supportsScheduling));
    if (channelId) where.channelId = channelId;
  } else if (scope === "private") {
    if (!currentUserId) throw new UnauthorizedError();
    if (channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel || (channel.ownerId !== currentUserId && !await isChannelEditor(channelId, currentUserId))) {
        throw new UnauthorizedError();
      }
      where.channelId = channelId;
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
      ];
    }
    // Private tab: drafts + scheduled (public flag off, or publish date in future).
    if (!supportsScheduling) {
      where.isPublic = false;
    } else {
      where.AND = [{ OR: [{ isPublic: false }, { publishedAt: { gt: now } }] }];
    }
  } else {
    if (!currentUserId) throw new UnauthorizedError();
    if (channelId) {
      // Non-owners may only see public posts of the channel
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel) throw new NotFoundError();
      where.channelId = channelId;
      if (channel.ownerId !== currentUserId && !await isChannelEditor(channelId, currentUserId)) {
        Object.assign(where, publicVisibilityFilter(now, supportsScheduling));
      }
    } else {
      where.OR = [
        { channel: { ownerId: currentUserId } },
        { channel: { editors: { some: { userId: currentUserId, role: { in: [...CHANNEL_AUTHOR_ROLES] } } } } },
      ];
    }
  }

  return where;
}

/**
 * Free-text search clause shared by the timeline and blog feeds: every term
 * must match at least one of the fields the caller names (case-insensitive
 * substring). `fieldFilters` returns the per-term alternatives so each feed
 * decides which columns/relations are searchable. Returns undefined for a
 * blank query so callers can skip it.
 */
export function buildFeedSearchWhere(
  query: string | undefined,
  fieldFilters: (term: string) => FeedScopeWhere[],
): FeedScopeWhere | undefined {
  const terms = (query ?? "").split(/\s+/).filter(Boolean).slice(0, FEED_SEARCH_MAX_TERMS);
  if (terms.length === 0) return undefined;
  return { AND: terms.map((term) => ({ OR: fieldFilters(term) })) };
}

/**
 * Append clauses to `where.AND` without clobbering what `resolveFeedScopeWhere`
 * already put there (the private scope uses `AND` for its draft/scheduled
 * filter), and without competing for the scope's top-level `OR`.
 */
export function andWhere<T extends { AND?: unknown }>(where: T, ...clauses: (object | undefined)[]): void {
  const extra = clauses.filter((c): c is object => c !== undefined);
  if (extra.length === 0) return;
  const existing = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
  where.AND = [...existing, ...extra];
}
