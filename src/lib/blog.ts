/**
 * Format a Date/ISO string for <input type="datetime-local"> (local time,
 * `YYYY-MM-DDTHH:mm`). Pure helper kept out of components for unit testing.
 */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse a datetime-local input value back to a Date, or undefined when empty.
 * Returns undefined (not Invalid Date) for blank/invalid input so Zod's
 * optional coercion stays clean.
 */
export function parseDateTimeLocalValue(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
