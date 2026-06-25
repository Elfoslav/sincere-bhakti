// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cb78b18cf6bf76111a55a6486d882533@o4511292367175680.ingest.de.sentry.io/4511627155341392",

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 1,

  enableLogs: true,

  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
