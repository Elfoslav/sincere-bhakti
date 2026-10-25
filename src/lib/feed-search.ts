import { FEED_SEARCH_MAX_TERMS } from "@/lib/validation";

/**
 * Whitespace-split search terms, capped so one query can't fan out into an
 * unbounded number of clauses. Shared by the server `q` filter and the
 * client-side check for freshly created items so both agree on what a query
 * means.
 */
export function splitSearchTerms(query: string | undefined): string[] {
  return (query ?? "").split(/\s+/).filter(Boolean).slice(0, FEED_SEARCH_MAX_TERMS);
}

/**
 * Whether an item would appear in a search-filtered feed: every term must be
 * found (case-insensitive substring) in at least one field. A blank query
 * matches everything. Mirrors the server filter.
 */
export function matchesSearch(query: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  const terms = splitSearchTerms(query);
  if (terms.length === 0) return true;
  const haystacks = fields.filter((f): f is string => Boolean(f)).map((f) => f.toLowerCase());
  return terms.every((term) => haystacks.some((h) => h.includes(term.toLowerCase())));
}
