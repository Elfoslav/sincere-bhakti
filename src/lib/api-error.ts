export function getApiErrorCode(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : "";
}

export function isApiErrorCode(body: unknown, expected: string): boolean {
  return getApiErrorCode(body) === expected;
}
