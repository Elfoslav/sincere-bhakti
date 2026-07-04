// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cb78b18cf6bf76111a55a6486d882533@o4511292367175680.ingest.de.sentry.io/4511627155341392",

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  enableLogs: true,

  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
