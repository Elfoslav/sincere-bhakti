export const BYTES_PER_MB = 1024 * 1024;

/**
 * Format a Date/ISO string for display ("September 11, 2026"). Falls back to
 * "en-US" for the "en" locale so month names stay in English. Pass
 * `withTime` for timestamps ("September 11, 2026, 10:05 AM").
 */
export function formatDisplayDate(
  value: Date | string | null | undefined,
  locale: string,
  opts?: { withTime?: boolean },
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(opts?.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
