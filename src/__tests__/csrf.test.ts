import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { validateOrigin } from "@/lib/csrf";

function mockRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("validateOrigin", () => {
  it("allows same-origin requests via Origin header", () => {
    const req = mockRequest({
      host: "example.com",
      origin: "https://example.com",
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it("rejects cross-origin requests via Origin header", () => {
    const req = mockRequest({
      host: "example.com",
      origin: "https://evil.com",
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it("allows same-origin requests via Referer when Origin is absent", () => {
    const req = mockRequest({
      host: "example.com",
      referer: "https://example.com/posts",
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it("rejects cross-origin requests via Referer", () => {
    const req = mockRequest({
      host: "example.com",
      referer: "https://evil.com/attack",
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it("fails closed when neither Origin nor Referer is present", () => {
    const req = mockRequest({ host: "example.com" });
    expect(validateOrigin(req)).toBe(false);
  });

  it("rejects when Host header is missing", () => {
    const req = mockRequest({ origin: "https://example.com" });
    expect(validateOrigin(req)).toBe(false);
  });
});
