import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    await ensureDefaultUser();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

async function ensureDefaultUser() {
  const { ensureDefaultUser: seed } = await import("./lib/seed");
  await seed();
}

export const onRequestError = Sentry.captureRequestError;
