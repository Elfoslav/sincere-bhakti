# 🪷 Sincere Bhakti

A spiritual social platform for devotees of Gaudiya Vaishnavism. Share realizations, kirtans, scriptural insights, and devotional media with the saṅga. Create an account, post text/images/video, set content as public or private, and browse the public timeline.

Built with [Next.js](https://nextjs.org).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Rate Limiting

Every mutation API endpoint is rate-limited using PostgreSQL (Prisma) in production and an in-memory `Map` locally/tests.

**Adding a new rate-limited endpoint:**
1. Add an entry to `RATE_LIMITS` in `src/lib/rate-limit.ts`
2. Use `RATE_LIMITS.xxx.limit` / `RATE_LIMITS.xxx.windowMs` — never inline numbers

```ts
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

const { allowed } = await rateLimit(rateLimitKey("prefix", userIdOrIp), RATE_LIMITS.xxx.limit, RATE_LIMITS.xxx.windowMs);
if (!allowed) {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}
```

The test mock in `src/__tests__/setup.ts` must also export the new `RATE_LIMITS` entry.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Tests

Run `pnpm test` and `pnpm lint` for unit/component coverage and static checks.
Browser tests require Playwright Chromium or `PLAYWRIGHT_CHANNEL=chrome` for an
installed Chrome browser.

Set `NEXTAUTH_SECRET`, a separate `TEST_DATABASE_URL`, and `E2E_TEST_PASSWORD`
in `.env` (see `.env.example`). Test accounts are disposable; use a generated
test password. `pnpm test:web:ui` runs the mocked UI suite.
`pnpm test:web:e2e` resets the test database before running real authentication,
publishing, and permission flows. `pnpm test:web:e2e:dirty` keeps the existing
test database and requires its migrations to be current.

Each browser suite uses its own Next.js output directory and test-result folder,
so it can start alongside a development server without sharing compilation state.
To target a server you have already started, set `PLAYWRIGHT_USE_EXISTING_SERVER=1`
and `PLAYWRIGHT_BASE_URL` to its URL. A real-database run must target a server
configured with `DATABASE_URL` equal to `TEST_DATABASE_URL`.
