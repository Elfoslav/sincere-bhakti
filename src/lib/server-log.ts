import * as Sentry from "@sentry/nextjs";

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordConfirm",
  "currentPassword",
  "newPassword",
  "token",
  "secret",
  "creditCard",
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? "[REDACTED]" : redact(value);
  }
  return result;
}

export function logServerError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, { level: "error", extra: { message } });
  }
  console.error(message, error);
}

export function logValidationError(route: string, issue: unknown, body: unknown) {
  const safe = redact(body);
  if (process.env.NODE_ENV === "production") {
    Sentry.captureMessage(`Validation error: ${route}`, {
      level: "warning",
      extra: { issue, body: safe },
    });
  }
  console.error(`${route} validation error:`, issue, "body:", safe);
}
