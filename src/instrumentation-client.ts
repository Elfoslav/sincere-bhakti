// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cb78b18cf6bf76111a55a6486d882533@o4511292367175680.ingest.de.sentry.io/4511627155341392",

  enabled: process.env.NODE_ENV === "production",

  // Sample 10% of transactions — tracing everything (1.0) adds overhead to
  // every client navigation and burns quota. Matches the server/edge configs.
  tracesSampleRate: 0.1,

  enableLogs: true,

  // Do not attach user IP/headers to events by default (privacy + payload size).
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
