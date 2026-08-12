import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const isDev = process.env.NODE_ENV === "development";

// `'unsafe-eval'` is only needed by React Fast Refresh / HMR in development.
// In production it is dropped so a script-injection cannot use eval().
// `'unsafe-inline'` on script-src is still required by Next.js hydration
// inline scripts; migrating to nonce-based CSP would need custom middleware.
const scriptSrc = isDev
  ? "'self' 'unsafe-eval' 'unsafe-inline'"
  : "'self' 'unsafe-inline'";

// Umami (privacy-friendly, cookieless analytics). The loader is served from
// cloud.umami.is (script-src), but the tracker POSTs events to a SEPARATE host,
// gateway.umami.is (connect-src) — both must be allowlisted or the browser
// loads the script yet silently blocks every event. Loaded only in production
// (see the RootLayout <Script>); allowlisting the hosts in all envs is harmless.
const UMAMI_SCRIPT_HOST = "https://cloud.umami.is";
const UMAMI_API_HOST = "https://gateway.umami.is";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc} ${UMAMI_SCRIPT_HOST}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.cloudflarestorage.com https://media.sincerebhakti.com",
  "media-src 'self' blob: https://*.r2.dev https://*.cloudflarestorage.com https://media.sincerebhakti.com",
  "frame-src https://www.youtube.com",
  `connect-src 'self' https://*.r2.dev https://*.cloudflarestorage.com https://o4511292367175680.ingest.de.sentry.io ${UMAMI_SCRIPT_HOST} ${UMAMI_API_HOST}`,
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.cloudflarestorage.com" },
      { protocol: "https", hostname: "media.sincerebhakti.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "tomas-hromnik",

  project: "sincere-bhakti",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // Not used — CSP already allows direct connections to Sentry ingest endpoint.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
