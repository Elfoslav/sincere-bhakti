import { afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { hashAnalyticsKey } from "@/lib/analytics-identity";
afterEach(() => vi.unstubAllEnvs());
it("fails closed without a configured key", () => {
  for (const key of ["ANALYTICS_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]) vi.stubEnv(key, "");
  expect(hashAnalyticsKey(["ip"])).toBeNull();
});
it("creates stable, unambiguous keyed hashes and supports key rotation", () => {
  vi.stubEnv("ANALYTICS_SECRET", randomBytes(32).toString("hex"));
  const result = hashAnalyticsKey(["a", "b"]);
  expect(result).toMatch(/^[a-f0-9]{64}$/);
  expect(hashAnalyticsKey(["a", "b"])).toBe(result);
  expect(hashAnalyticsKey(["a,b"])).not.toBe(result);
  vi.stubEnv("ANALYTICS_SECRET", randomBytes(32).toString("hex"));
  expect(hashAnalyticsKey(["a", "b"])).not.toBe(result);
});
