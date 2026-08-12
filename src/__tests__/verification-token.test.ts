import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/prisma", () => ({ prisma: { verificationToken: { upsert, update: vi.fn() } } }));

import { hashToken, generateVerificationTokenValue, issueVerificationToken } from "@/lib/verification-token";

describe("hashToken", () => {
  it("is a deterministic SHA-256 hex digest that differs from the input", () => {
    const raw = "abc123";
    const expected = crypto.createHash("sha256").update(raw).digest("hex");
    expect(hashToken(raw)).toBe(expected);
    expect(hashToken(raw)).toHaveLength(64);
    expect(hashToken(raw)).not.toBe(raw);
  });
});

describe("generateVerificationTokenValue", () => {
  it("returns 256 bits of hex entropy", () => {
    expect(generateVerificationTokenValue()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("issueVerificationToken", () => {
  beforeEach(() => upsert.mockClear());

  it("stores the HASH at rest and returns the RAW token for the email link", async () => {
    const raw = await issueVerificationToken("user@example.com", "verify", 60_000);

    // Returned value is the raw token (goes in the email).
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    // Persisted value is its hash, never the raw token.
    const call = upsert.mock.calls[0][0];
    expect(call.create.token).toBe(hashToken(raw));
    expect(call.update.token).toBe(hashToken(raw));
    expect(call.create.token).not.toBe(raw);
  });
});
