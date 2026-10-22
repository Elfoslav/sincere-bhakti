import { createHmac } from "node:crypto";

/** Server-only keyed identifiers. Never fall back to a public/predictable key. */
export function hashAnalyticsKey(parts: string[]): string | null {
  const secret = process.env.ANALYTICS_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return secret ? createHmac("sha256", secret).update(JSON.stringify(parts)).digest("hex") : null;
}
