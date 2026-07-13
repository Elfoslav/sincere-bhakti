import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    try {
      const { ensureDefaultUser } = await import("./lib/seed");
      await ensureDefaultUser();
    } catch (e) {
      console.error("[instrumentation] seed failed:", e);
    }

    try {
      const { fixLegacyPersonalChannelSlugs } = await import("./lib/services/channel");
      await fixLegacyPersonalChannelSlugs();
    } catch (e) {
      console.error("[instrumentation] fixLegacySlugs failed:", e);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
