import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cb78b18cf6bf76111a55a6486d882533@o4511292367175680.ingest.de.sentry.io/4511627155341392",

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  enableLogs: true,

  sendDefaultPii: true,
});
