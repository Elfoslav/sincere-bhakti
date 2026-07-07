import * as Sentry from "@sentry/nextjs";

export function logServerError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, { level: "error", extra: { message } });
  }
  console.error(message, error);
}

export function logValidationError(route: string, issue: unknown, body: unknown) {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureMessage(`Validation error: ${route}`, {
      level: "warning",
      extra: { issue, body },
    });
  }
  console.error(`${route} validation error:`, issue, "body:", body);
}
