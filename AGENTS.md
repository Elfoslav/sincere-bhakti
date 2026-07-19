<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:code-organization -->
# Code Organization

- **No repeating code.** Any pattern used in more than one place must be extracted to a shared function in `src/lib/` or a shared constant.
- **Utility functions** go in `src/lib/` (e.g. `video.ts`, `auth.ts`, `validation.ts`, `rate-limit.ts`).
- **Extract pure utilities from components.** Any function inside a `.tsx` file that has no React hooks (`useState`, `useEffect`, etc.) and no browser-DOM dependency must be moved to `src/lib/` so it can be unit-tested without jsdom. Examples: `genId()`, `formatBytes()`, `getSiteUrl()`.
- **Do not duplicate constants that are already exported from `src/lib/`.** If a list, threshold, or config constant exists in a lib file, import it — never redeclare it locally.
- **Reusable UI** goes in `src/components/` or `src/components/ui/` (shadcn).
- Dialogs MUST use the shared `DialogHeader` from `src/components/ui/dialog.tsx` for standard headings. Pass `text` for the title, `subheading` for helper text, and `subheadingRight` when compact metadata/counts should align to the right. Use raw `DialogTitle` / `DialogDescription` only for unusual custom layouts that `DialogHeader` cannot express.
- **Types/interfaces** shared across files MUST go in `src/types/` and be imported where needed — never define the same type inline in multiple places. Service-specific types may stay in the service file but must be exported. Component-props interfaces stay co-located with the component.
- Inline the same logic in multiple files only if there's a strong reason — otherwise refactor.
- **No dead type exports.** If a type/interface is defined in `src/types/` and not imported anywhere, remove it.
- **No ambient types.** Do not rely on `.d.ts` files for types that are used as values or exported. Use explicit imports.
<!-- END:code-organization -->

<!-- BEGIN:env-secrets -->
# Secrets & Environment Variables

- **Never hardcode secrets, connection strings, API keys, or any sensitive value.** Every secret MUST be defined in `.env` (or `.env.local`) and accessed via `process.env.VARIABLE_NAME`. This includes database URLs, auth secrets, API tokens, and any per-environment configuration.
- **Exception**: default/fallback values for non-secret configuration (e.g. `PORT` defaulting to `3000`) are acceptable as inline constants.
- **Test files** must read env vars from `process.env`, not hardcode them. Use `dotenv/config` or a similar loader in config files that need env vars before the app boots.
- **When you see a hardcoded secret, treat it as a bug.** Refactor it to `.env` immediately. Do not defer.
<!-- END:env-secrets -->

<!-- BEGIN:agent-checklist -->
# Agent Checklist — Always Verify Before Writing Code

## Rate Limiting
Every API endpoint (including read endpoints) and every SSR page MUST have rate limiting. On Vercel (production) rate limiting uses the existing PostgreSQL database via Prisma. Locally/tests use an in-memory Map. Use the shared helpers:

```ts
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";

const ip = getClientIp(request.headers);
if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) {
  return NextResponse.json({ error: ERROR_TOO_MANY_REQUESTS }, { status: HTTP_TOO_MANY_REQUESTS });
}
```

- `getClientIp(headers)` — extracts the client IP from `x-forwarded-for`, falls back to `"unknown"`.
- `checkRateLimit(prefix, identifier, limit, windowMs)` — checks the limit, logs a `rate_limited` warning on rejection, returns `boolean`.
- `RATE_LIMIT_PREFIX.xxx` — shared prefix constants (never inline strings like `"read-posts"`).
- `RATE_LIMITS.xxx.limit` / `RATE_LIMITS.xxx.windowMs` — shared limit config (never inline magic numbers).

Every new rate-limited endpoint must add entries to BOTH `RATE_LIMITS` and `RATE_LIMIT_PREFIX` in `src/lib/rate-limit.ts`. Every `RATE_LIMITS` entry must have a human-readable comment describing the limit and window (e.g. `// Read posts: 120 requests per 60s per IP`).

Return error codes from API routes (import `ERROR_TOO_MANY_REQUESTS` from `@/lib/error-messages`, `HTTP_TOO_MANY_REQUESTS` from `@/lib/error-codes`) — never inline strings or raw numbers.

Also add rate limiting to the login flow in `src/lib/auth.ts` — the `authorize` callback receives `req` as second param:

```ts
const ip = req?.headers ? getClientIp(req.headers) : "unknown";
if (!await checkRateLimit(RATE_LIMIT_PREFIX.login, ip, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs)) return null;
```

**SSR pages**: Add `checkRateLimit` to the page component only — do NOT add it to `generateMetadata`. Adding it to metadata double-charges each page view (two quota units per request) and can cause false 404s under shared-IP or crawler traffic.

```ts
// In the page component only, not in generateMetadata:
const ip = getClientIp(await headers());
if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();
```

Existing rate-limit entries (all defined in `src/lib/rate-limit.ts`):
| Key | Identifier | Limit | Window | Scope |
|---|---|---|---|---|
| `register` | IP | 20 | 1 hour | Registration |
| `login` | IP | 15 | 15 min | Auth login |
| `readPosts` | IP | 120 | 60 s | Post feed & detail SSR + API |
| `readPostDetail` | IP | 120 | 60 s | Single post API |
| `readChannel` | IP | 60 | 60 s | Channel detail SSR + API |
| `readProfile` | IP | 60 | 60 s | User profile API |
| `searchChannels` | IP | 30 | 60 s | Channel search API |
| `createPost` | userId | 20 | 1 hour | Post creation |
| `updatePost` | userId | 30 | 1 hour | Post update |
| `deletePost` | userId | 30 | 1 hour | Post deletion |
| `upload` | userId | 60 | 1 hour | Upload, cleanup, compress (production only) |
| `uploadUrl` | userId | 20 | 1 hour | Presigned URL generation |
| `updateProfile` | userId | 10 | 1 hour | Profile rename |
| `createChannel` | userId | 10 | 1 hour | Channel creation |
| `updateChannel` | userId | 10 | 1 hour | Channel rename |

For new endpoints, pick a reasonable limit that regular users won't hit but blocks abuse.

## Shared Constants for Validation
Never hardcode validation thresholds. Define them in `src/lib/validation.ts` and export them:

```ts
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 50;
```

Then import and use them everywhere — client-side checks, HTML `minLength`, Zod schemas — so all three stay in sync.

## User-Supplied URLs & Uploads
- **Never accept a bare `z.string().url()` for a URL that will be rendered.** `.url()` accepts dangerous schemes like `javascript:` and `data:`, which become stored XSS when placed in `<a href>`/`<img src>`/`<iframe src>`. Always chain `.refine(isSafeHttpUrl)` (from `src/lib/validation.ts`) to restrict to `http:`/`https:`. This applies to all media URLs and any other user-provided link.
- **Restrict upload content types to an allowlist.** `uploadUrlSchema.contentType` uses `isAllowedUploadContentType` (only `image/` and `video/` prefixes) so users can't stash arbitrary files (e.g. HTML) in the bucket. Add new prefixes to `ALLOWED_UPLOAD_CONTENT_TYPE_PREFIXES` if a new media kind is genuinely needed.
- **Enforce a max upload size, per media type.** Check `file.size <= maxUploadSizeForContentType(file.type)` on the client before requesting a presigned URL, and surface a translated error (`PostsPage.fileTooLarge`, which interpolates `{imageMax}`/`{videoMax}`). Limits live in `src/lib/validation.ts` (`MAX_IMAGE_SIZE_BYTES` = 10 MB, `MAX_VIDEO_SIZE_BYTES` = 200 MB). This is a UX guard only — the file uploads browser→R2 directly, so it is not server-enforced; use a presigned-POST `content-length-range` or multipart if hard enforcement is needed. The 200 MB video ceiling assumes the single presigned-PUT flow (R2 caps a single PUT at 5 GiB); larger/long-form video needs multipart upload.
- Prefer validating that media URLs originate from the known storage domain (`R2_PUBLIC_URL`) or a whitelisted provider (YouTube) rather than accepting any `https:` URL, when feasible.
- **Direct browser→R2 uploads require bucket CORS.** The version-controlled policies live in `infra/r2/` (`cors-dev.json`, `cors-prod.json`) with apply/verify instructions in `infra/r2/README.md`. Update those files (and re-apply via `wrangler r2 bucket cors put`) whenever the app's origin, allowed methods, or upload headers change.

## Translations
- Every user-facing string must use `useTranslations("Namespace")` on client or `getTranslations({locale, namespace})` on server.
- Add new keys to ALL three message files (`en.json`, `cs.json`, `sk.json`).
- Never hardcode English strings like "Public" / "Private" / "Delete" in components — they must come from translation files.
- Reuse existing namespace keys when possible. Avoid duplicating the same key in multiple namespaces.
- When adding UI text, check if a translation key already exists before creating one.

## Posts & Language Filtering
- Every `useInfinitePosts` call MUST pass `language: locale` (from `useLocale()`) so posts are always filtered by the currently selected locale. This applies everywhere — homepage, profile page, and any future page that displays posts. The API and service layer already support the parameter; the only missing piece is the caller passing it through.

## Links & Navigation
- Always use `Link` from `@/i18n/navigation` for internal links — never `next/link` or `<a>` tags.
- `Link` auto-prepends locale prefixes (`/cs/login`, `/sk/login`). Plain `<a href="/login">` breaks i18n.
- For programmatic navigation in client components, use `useRouter` from `@/i18n/navigation`.

## API Routes
- `params` and `searchParams` are Promises in Next.js 16 — always `await` them.
- Validate input with Zod schemas from `src/lib/validation.ts` before processing.
- Business logic goes in `src/lib/services/` — routes are thin wrappers (parse, rate limit, delegate, respond).
- Use custom error classes (`UnauthorizedError`, `NotFoundError`, `ForbiddenError`) with `instanceof` checks — no string matching on error messages.
- `console.error` is acceptable for caught errors in API routes. Replace with `Sentry.captureException(error)` if you want the error tracked in Sentry.
- **CSRF protection**: Every mutation endpoint (POST/PATCH/DELETE) MUST call `validateOrigin(request)` from `@/lib/csrf` at the top of the handler. Return 403 if invalid. `validateOrigin` **fails closed** — a request with neither `Origin` nor `Referer` is rejected. Do not "relax" it to return `true` on missing headers.
- **Error codes, not English strings**: API routes return error codes like `"validation_error:name:too_small"`, `"email_in_use"`, `"server_error"`, `"too_many_requests"`, `"not_found"`. Never return English sentences from API routes — clients map codes to translated messages.
- **Use shared error message constants**: Always import error message strings from `@/lib/error-messages` (`ERROR_UNAUTHORIZED`, `ERROR_FORBIDDEN`, `ERROR_NOT_FOUND`, `ERROR_TOO_MANY_REQUESTS`, `ERROR_SERVER_ERROR`, `ERROR_EMAIL_IN_USE`) — never inline them. Add new constants to that file when adding a new error message. This keeps casing consistent (`"unauthorized"` not `"Unauthorized"`).
- **Use shared HTTP status code constants**: Always import status codes from `@/lib/error-codes` (`HTTP_BAD_REQUEST`, `HTTP_UNAUTHORIZED`, `HTTP_FORBIDDEN`, `HTTP_NOT_FOUND`, `HTTP_CONFLICT`, `HTTP_TOO_MANY_REQUESTS`, `HTTP_INTERNAL_SERVER_ERROR`, `HTTP_CREATED`) — never inline raw numbers.
- **Zod schemas**: Do NOT use custom error messages in Zod `.min()`, `.max()`, `.email()` calls. The API route converts validation errors to structured codes: `validation_error:{field}:{issue.code}`.
- **Never leak server errors**: `catch` blocks must always return generic error codes, never the original error message.

## Service Layer (`src/lib/services/`)
- Prisma `where` clauses must use proper generated types (`Prisma.PostWhereInput`) not `Record<string, unknown>`.
- All database queries should be paginated (`take` + `cursor`) — never return unbounded result sets.
- Use Prisma schema defaults (`@default("en")`) as safety net instead of hardcoding fallback values everywhere.

## Authorization / Access Control
- **Never trust a user-supplied id to scope a query.** When a query accepts an `authorId`/`userId` filter that could differ from the caller, you MUST also constrain visibility. Example: `getPosts` returns another user's posts ONLY when `isPublic = true`; a caller's own private rows are returned only when `authorId === currentUserId`. A missing visibility filter is a broken-access-control (IDOR) bug — the classic mistake is `where.authorId = authorId || currentUserId` with no `isPublic` guard, which lets any logged-in user read others' private data.
- Regression-test both directions: "own private posts are returned" AND "another user's private posts are NOT returned".
- Ownership-mutating operations (delete/update) must scope by owner in the `where` clause itself (`deleteMany({ where: { id, authorId } })`), not by fetching then comparing in JS.
- For not-found vs. forbidden: returning `404` for resources the caller isn't allowed to see (instead of `403`) avoids leaking existence.

## Images
- Use `next/image` with `style={{ width: <desired>, height: "auto" }}` to lock one dimension and let the other scale. This avoids the "width or height modified, but not the other" warning.
- When you need a fixed size, set both dimensions in `style`: `style={{ width: 77, height: 32 }}`.
- Add `aria-label` to icon-only buttons (delete, external link, etc.) for accessibility.
- Logo `alt`/`title` attributes must use translation keys (e.g. `Navbar.logoAlt`, `HomePage.logoAlt`), not hardcoded strings.

## Error Handling
- Add `error.tsx` (error boundary) files at each route segment level so a crash doesn't white-screen the entire app.
- Add `loading.tsx` at route segments for skeleton UIs during page transitions.
- The global `not-found.tsx` must NOT import unused components — remove dead imports.
- The global `not-found.tsx` (outside `[locale]`) is a fallback; the locale-specific one renders for most 404s.

## Tests
- **Always run `pnpm test`** before writing any code to see the current test state.
- After making changes, run `pnpm test` again and fix any failing tests before considering work complete.
- **Always run `pnpm lint`** alongside tests and fix any errors and warnings before considering work complete. The only exception is `@next/next/no-img-element` (using `<img>` vs `<Image>`) — that can be intentional.
- **Every extracted lib function must have a corresponding test file.** Pure functions in `src/lib/` (format, id, url, etc.) get their own `src/__tests__/<name>.test.ts`. Browser-API functions in `src/lib/` (client-media, etc.) are tested by mocking the browser API.
- Every test file that exercises error paths (e.g. "returns 500 on server error") MUST silence `console.error` to keep stderr clean:
  ```ts
  vi.spyOn(console, "error").mockImplementation(() => {});
  ```
  Place this after all `vi.mock` calls and before `import` statements.
- Without it, Vitest prints "stderr | …" messages for every caught `console.error` in route handlers, polluting test output.

## Removing Dead Code
- If a prop (like PostCard's `onDelete`) is never passed by any parent, either implement it or remove it.
- If translation keys exist in message files but are never used in any component, they are dead code — remove them.
- If a component is imported but not used in the JSX, remove the import.

## Security Headers
- Security headers are defined in `next.config.ts` via the `headers()` function:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` with restricted script/style/img/media/connect sources, plus `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`
- The CSP is built from the `contentSecurityPolicy` array in `next.config.ts`. `'unsafe-eval'` is included in `script-src` ONLY in development (React Fast Refresh needs it) and dropped in production — do not add it back to the production policy. `script-src 'unsafe-inline'` is still required by Next.js hydration; removing it needs nonce-based CSP via middleware.
- Any new `next.config.ts` changes must preserve these headers.

## User Profile API
- `GET /api/users/[id]` only returns `email` when the requesting user is the profile owner:
  ```ts
  select: {
    id: true, name: true, image: true, createdAt: true,
    ...(session?.user?.id === id ? { email: true } : {}),
  }
  ```

## Types & Interfaces
- **Shared types** (used across modules) go in `src/types/`, one file per domain (`post.ts`, `user.ts`).
- **Service-layer types** may stay in the service file but must be exported. If a service type duplicates a shape in `src/types/`, remove the local definition and import from types instead.
- **Component props** stay co-located with the component — do not extract them to `src/types/`.
- **No duplicate shapes.** If two files define the same shape, extract it to `src/types/`.
- **No dead exports.** If a type in `src/types/` has zero imports, remove it.
- **No ambient declarations.** Prefer explicit `import type` over `.d.ts` ambient types.
- **Import types with `type` prefix** when only the type is needed: `import type { Foo } from "@/types/foo"`.

## Auth / Session
- Use `status === "authenticated"` (from `useSession()`) for conditional rendering of auth-gated UI (profile link, logout button). The `status` string is stable during client-side navigation and doesn't flash. Do NOT use `session &&` — the `session` object can briefly become `null` during re-renders triggered by locale navigation, causing visible flicker.
## Trimming User Input
- Every string field from user input (name, email, password, content, etc.) must be `.trim()`ed before being stored or used in comparisons.
- In Zod schemas, always use `.trim()` on string fields — never rely on the caller to trim. The parsed output is already trimmed, so downstream code receives clean values.
- The only place raw user input enters without Zod is the JWT callback in `auth.ts` — but there `user.name` comes from the database (already trimmed by the Zod schema on registration). Still, be defensive: if a future flow passes untrimmed data to `createPersonalChannel` or any DB write, trim it there.
- Current coverage:
  - `registerSchema.name` — `.trim()` ✅
  - `registerSchema.email` — `.trim().toLowerCase()` ✅
  - `updateNameSchema.name` — `.trim()` ✅
  - `createPostSchema.content` (via `contentField`) — `.trim()` ✅
  - `updatePostSchema.content` — `.trim()` ✅
  - `paginationSchema.cursor` — `.trim()` ✅
  - `normalizeName()` — calls `.trim()` internally ✅
  - `registerSchema.password` — `.trim()` ✅ (client warns first if whitespace is detected, then server trims)
<!-- END:agent-checklist -->
