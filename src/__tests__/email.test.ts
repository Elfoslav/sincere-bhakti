import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: function SESv2Client() {
    return { send: vi.fn() };
  },
  SendEmailCommand: vi.fn(),
}));

vi.mock("@/lib/url", () => ({
  getSiteUrl: vi.fn(() => "https://example.com"),
}));

import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { buildHtml, sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

describe("buildHtml", () => {
  const opts = {
    logoSrc: "https://example.com/logo.png",
    heading: "Test Heading",
    body: "Click the button below to proceed.",
    buttonText: "Confirm",
    link: "https://example.com/action?token=abc",
    footer: "If you did not request this, ignore.",
  };

  it("includes the heading in the title", () => {
    const html = buildHtml(opts);
    expect(html).toContain("<title>Test Heading</title>");
  });

  it("includes the heading in the h1", () => {
    const html = buildHtml(opts);
    expect(html).toContain(">Test Heading<");
  });

  it("includes the body text", () => {
    const html = buildHtml(opts);
    expect(html).toContain("Click the button below to proceed.");
  });

  it("includes the link in the button href", () => {
    const html = buildHtml(opts);
    expect(html).toContain('href="https://example.com/action?token=abc"');
  });

  it("includes the button text", () => {
    const html = buildHtml(opts);
    expect(html).toContain("Confirm");
  });

  it("includes the fallback link text", () => {
    const html = buildHtml(opts);
    expect(html).toContain("https://example.com/action?token=abc");
  });

  it("includes the footer text", () => {
    const html = buildHtml(opts);
    expect(html).toContain("If you did not request this, ignore.");
  });

  it("uses the provided logo src", () => {
    const html = buildHtml({ ...opts, logoSrc: "https://cdn.example.com/custom-logo.png" });
    expect(html).toContain('src="https://cdn.example.com/custom-logo.png"');
  });

  it("starts with a doctype", () => {
    const html = buildHtml(opts);
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });
});

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the command with the correct destination", async () => {
    await sendVerificationEmail("user@example.com", "token123", "en");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Destination?.ToAddresses).toEqual(["user@example.com"]);
  });

  it("includes the verify link in the HTML body", async () => {
    await sendVerificationEmail("user@example.com", "token123", "en");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    const html = cmd.Content?.Simple?.Body?.Html?.Data ?? "";
    expect(html).toContain("/en/verify-email?token=token123");
  });

  it("uses the locale in the verification link", async () => {
    await sendVerificationEmail("user@example.com", "tok", "cs");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    const html = cmd.Content?.Simple?.Body?.Html?.Data ?? "";
    expect(html).toContain("/cs/verify-email?token=tok");
  });

  it("uses the correct subject for a Czech locale", async () => {
    await sendVerificationEmail("user@example.com", "tok", "cs");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toContain("Ověřte svůj e-mail");
  });

  it("uses the correct subject for a Slovak locale", async () => {
    await sendVerificationEmail("user@example.com", "tok", "sk");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toContain("Overte svoj e-mail");
  });

  it("uses English subject for an unsupported locale", async () => {
    await sendVerificationEmail("user@example.com", "tok", "de");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toBe("Verify your email — Sincere Bhakti");
  });

  it("sanitizes an invalid/malicious locale out of the link (no HTML injection)", async () => {
    await sendVerificationEmail("user@example.com", "tok", '"><img src=x onerror=alert(1)>');

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    const html = cmd.Content?.Simple?.Body?.Html?.Data ?? "";
    // The bogus locale is coerced to the default, so nothing is injected and the
    // link is well-formed.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("/en/verify-email?token=tok");
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the command with the correct destination", async () => {
    await sendPasswordResetEmail("user@example.com", "resettoken", "en");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Destination?.ToAddresses).toEqual(["user@example.com"]);
  });

  it("includes the reset link in the HTML body", async () => {
    await sendPasswordResetEmail("user@example.com", "resettoken", "en");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    const html = cmd.Content?.Simple?.Body?.Html?.Data ?? "";
    expect(html).toContain("/en/reset-password?token=resettoken");
  });

  it("uses the correct subject for a Czech locale", async () => {
    await sendPasswordResetEmail("user@example.com", "tok", "cs");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toContain("Obnovení hesla");
  });

  it("uses the correct subject for a Slovak locale", async () => {
    await sendPasswordResetEmail("user@example.com", "tok", "sk");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toContain("Obnovenie hesla");
  });

  it("uses English subject for an unsupported locale", async () => {
    await sendPasswordResetEmail("user@example.com", "tok", "fr");

    const cmd = vi.mocked(SendEmailCommand).mock.calls[0][0];
    expect(cmd.Content?.Simple?.Subject?.Data).toBe("Reset your password — Sincere Bhakti");
  });
});
