/** Shared collection contract. Add resource types only with a server visibility resolver. */
export const ANALYTICS_RESOURCE_TYPES = ["blogPost"] as const;
export const ANALYTICS_EVENTS = ["view", "read"] as const;
export const ANALYTICS_READ_TIME_MS = 30_000;
export const ANALYTICS_RECEIPT_TTL_MS = 48 * 60 * 60 * 1000;
export const ANALYTICS_CLEANUP_BATCH = 100;
export const ANALYTICS_EMPTY_COUNTS = { views: 0, reads: 0, uniqueVisitors: 0 };
