<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:code-organization -->
# Code Organization

- **No repeating code.** Any pattern used in more than one place must be extracted to a shared function in `src/lib/` or a shared constant.
- **Utility functions** go in `src/lib/` (e.g. `video.ts`, `auth.ts`, `validation.ts`, `rate-limit.ts`).
- **Reusable UI** goes in `src/components/` or `src/components/ui/` (shadcn).
- **Types/interfaces** shared across files go in `src/types/`.
- Inline the same logic in multiple files only if there's a strong reason — otherwise refactor.
<!-- END:code-organization -->

<!-- BEGIN:agent-checklist -->
# Agent Checklist — Always Verify Before Writing Code

## Rate Limiting
Every mutation API endpoint MUST have rate limiting. Use the shared utility:

```ts
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

const { allowed } = rateLimit(rateLimitKey("unique-prefix", userIdOrIp), maxRequests, windowMs);
if (!allowed) {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}
```

Return error codes (not English strings) from API routes so clients can map to translations.

Also add rate limiting to the login flow in `src/lib/auth.ts` — the `authorize` callback receives `req` as second param:

```ts
const ip = req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const { allowed } = rateLimit(rateLimitKey("login", ip), 10, 900_000);
if (!allowed) return null;
```

Existing prefixes: `register` (by IP, 5/hour), `create-post` (by userId, 20/hour), `upload-url` (by userId, 20/hour), `delete-post` (by userId, 30/hour), `update-profile` (by userId, 10/hour), `login` (by IP, 10/15min). For new endpoints, pick a reasonable limit that regular users won't hit but blocks abuse.

## Shared Constants for Validation
Never hardcode validation thresholds. Define them in `src/lib/validation.ts` and export them:

```ts
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 50;
```

Then import and use them everywhere — client-side checks, HTML `minLength`, Zod schemas — so all three stay in sync.

## Translations
- Every user-facing string must use `useTranslations("Namespace")` on client or `getTranslations({locale, namespace})` on server.
- Add new keys to ALL three message files (`en.json`, `cs.json`, `sk.json`).
- Never hardcode English strings like "Public" / "Private" / "Delete" in components — they must come from translation files.
- Reuse existing namespace keys when possible. Avoid duplicating the same key in multiple namespaces.
- When adding UI text, check if a translation key already exists before creating one.

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
- **CSRF protection**: Every mutation endpoint (POST/PATCH/DELETE) MUST call `validateOrigin(request)` from `@/lib/csrf` at the top of the handler. Return 403 if invalid.
- **Error codes, not English strings**: API routes return error codes like `"validation_error:name:too_small"`, `"email_in_use"`, `"server_error"`, `"too_many_requests"`, `"not_found"`. Never return English sentences from API routes — clients map codes to translated messages.
- **Zod schemas**: Do NOT use custom error messages in Zod `.min()`, `.max()`, `.email()` calls. The API route converts validation errors to structured codes: `validation_error:{field}:{issue.code}`.
- **Never leak server errors**: `catch` blocks must always return generic error codes, never the original error message.

## Service Layer (`src/lib/services/`)
- Prisma `where` clauses must use proper generated types (`Prisma.PostWhereInput`) not `Record<string, unknown>`.
- All database queries should be paginated (`take` + `cursor`) — never return unbounded result sets.
- Use Prisma schema defaults (`@default("en")`) as safety net instead of hardcoding fallback values everywhere.

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
  - `Content-Security-Policy` with restricted script/style/img/media/connect sources
- Any new `next.config.ts` changes must preserve these headers.

## User Profile API
- `GET /api/users/[id]` only returns `email` when the requesting user is the profile owner:
  ```ts
  select: {
    id: true, name: true, image: true, createdAt: true,
    ...(session?.user?.id === id ? { email: true } : {}),
  }
  ```
<!-- END:agent-checklist -->
