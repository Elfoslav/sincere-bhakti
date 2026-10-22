# Content analytics: plan and implementation

## Goals and definitions

Use one first-party, cookie-free collection API and aggregate storage for content analytics. Start with blog articles; later support feed posts, channels, referrals, conversions and engagement dashboards using the same resource/metric/day model.

- **View / visit**: one visible article mount (including navigation back or refresh). Requests, SSR prefetches, crawlers and feed previews do not count. An in-memory UUID makes Strict Mode replay/retries idempotent. This is an article visit, not a cross-page session.
- **Read**: a view with at least 30 seconds of foreground time and the end of the article reached. Server receipts require an existing view at least 30 seconds old and accept at most one read per visit. These are engagement estimates, not proof a person read every word. Embedded video playback alone is not a read.
- **Unique daily visitor**: at most one per public article per UTC day, estimated from a keyed HMAC over resource, date, IP and user-agent. Daily estimates are summed for the lifetime display (visitor-days), not lifetime distinct people. Shared IP/browser combinations can merge people; browser/IP changes can split them. Missing IPs count views/reads but no unique visitor. There is no cookie-free exact persistent identity.

Counts start when deployed; there is no historical backfill. Article authors' visits count too. DNT and Global Privacy Control suppress collection but still allow reading counters. Known bot/preview user agents are filtered; ad blockers and disabled JavaScript can undercount. Public counters are approximate and rate limited, not fraud-resistant billing metrics.

## Architecture implemented

1. `src/lib/analytics.ts` defines resource/event types, thresholds and defaults; Zod contracts live in `validation.ts`. No arbitrary client-defined metrics or target types.
2. `GET /api/analytics?resourceType=blogPost&resourceId=…` returns aggregate views, reads, and uniqueVisitors. `POST` to the same URL accepts `{event: "view" | "read", visitId: UUID}` and returns updated counters. Origin checks, rate limits and input validation apply. Responses are private/no-store.
3. The service resolves public visibility before reads and writes. Missing, private and scheduled posts return 404 even to their owners. The write transaction checks visibility again. No private analytics/ownership oracle is exposed.
4. `AnalyticsDaily` stores `(resourceType, resourceId, UTC day, metric, count)`. Atomic upserts preserve counts under concurrency. History contains aggregates only and survives content deletion; no endpoint exposes it for deleted resources.
5. `AnalyticsReceipt` holds only keyed idempotency/uniqueness hashes and timestamps. Unique receipt insertion and counter increments share a transaction; duplicate requests and simultaneous tabs cannot double-increment the same daily unique visitor. Read claims use an atomic conditional update. Receipts expire after 48 hours, with bounded cleanup during collection and an operator cleanup command for quiet periods.
6. `BlogAnalytics` owns the browser lifecycle and shows counts below every public article. It uses no cookies, localStorage or sessionStorage and sends analytics requests with credentials omitted. Foreground time pauses in background tabs. The visits token lives only for the mounted article. Preview/list cards do not collect visits.

## Privacy and operations

Analytics tables never store raw IP, user-agent, referrer, full URL, user ID or email. Analytics endpoint rate-limit identifiers are keyed and day-scoped too. Existing platform/proxy logs and the application's other rate limits have their own retention; this feature does not change them. The current site-wide Umami/Vercel integrations remain separate.

Set `ANALYTICS_SECRET` to a random server-only secret in deployment environment configuration (generate with `openssl rand -hex 32`). It falls back to existing `AUTH_SECRET`/`NEXTAUTH_SECRET`; without any key, collection is disabled and existing counts remain readable. Never expose the key in `NEXT_PUBLIC_` variables. HMAC inputs include the date and resource, preventing direct cross-day/resource linking from stored hashes; this is pseudonymous processing, not a claim of legal anonymization. Rotating the root secret resets current-day deduplication. No new browser consent state is created by this collector.

Deployment: run the normal `prisma migrate deploy` before serving the new code (`pnpm build` already does this), then regenerate the Prisma client. The migration adds tables only. Never point test migrations/reset scripts at production.

Run `pnpm exec tsx scripts/cleanup-analytics.ts` daily using the hosting scheduler to remove all expired receipts even during quiet periods. Ingestion already removes up to 100 expired receipts per accepted request. Expired records cannot be used to accept reads, even before physical removal. Without a scheduler, 48 hours is logical expiry, not a guaranteed physical deletion deadline. Configure the scheduled command and disclose the collection/retention in the site's privacy notice before launch. Monitor counter/write latency, cleanup backlog, and 429/5xx rates. SQL backups follow their existing retention policy.

YouTube embeds are a separate third-party feature. The editor emits canonical `youtube-nocookie.com` players without autoplay; sanitization rejects arbitrary iframe hosts/attributes and CSP allows the player. Privacy-enhanced mode is not a guarantee that interacting with YouTube never uses cookies.

## Extension plan

1. Add a resource type and explicit visibility resolver (and authorization for any private dashboard); reuse collector/counters rather than cloning blog logic. Each resolver must recheck visibility inside the collection transaction.
2. Add allowlisted semantic events and corresponding metrics; never accept unrestricted event names, arbitrary JSON, URLs or personal data. Keep existing metric definitions stable; version changes to engagement definitions.
3. Add batched aggregate reads for listing/dashboard cards, date ranges and channel summaries with authorization, pagination, and indexes matching each query. Do not sum per-resource daily uniques and label the result site-wide unique people.
4. If funnels or visit sessions become necessary, explicitly define session boundaries and retention. Truly persistent unique people across days require a different identity/consent tradeoff. Do not silently expand current pseudonymous collection.
5. Add coarse referrer/campaign dimensions only after defining an allowlist, stripping query strings and assessing retention. Add rollups/partitioning as volume warrants; retain aggregates, expire dedupe receipts, and monitor costs.

## Verification

Unit/API/UI tests cover URL validation, embed sanitization and persistence, contracts, private/scheduled visibility, deduplication, privacy signals, and visible-time reads. Database-backed E2E tests verify the editor publish/reopen flow and atomic counting against PostgreSQL.
