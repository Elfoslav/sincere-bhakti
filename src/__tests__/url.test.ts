import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSiteUrl } from "@/lib/url";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("returns NEXTAUTH_URL when set", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://example.com");
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("falls back to Vercel URL when NEXTAUTH_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "my-app.vercel.app");
    expect(getSiteUrl()).toBe("https://my-app.vercel.app");
  });

  it("falls back to localhost when neither env var is set", () => {
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
