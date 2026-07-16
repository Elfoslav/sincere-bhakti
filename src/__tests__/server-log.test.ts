import { describe, it, expect, vi, beforeEach } from "vitest";

vi.spyOn(console, "error").mockImplementation(() => {});

import { logValidationError } from "@/lib/server-log";

describe("server log redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts current and new passwords from validation logs", () => {
    logValidationError(
      "PATCH /api/users/[id]/password",
      { code: "too_small" },
      {
        currentPassword: "old-secret",
        newPassword: "new-secret",
        nested: [{ password: "nested-secret" }],
      },
    );

    expect(console.error).toHaveBeenCalledWith(
      "PATCH /api/users/[id]/password validation error:",
      { code: "too_small" },
      "body:",
      {
        currentPassword: "[REDACTED]",
        newPassword: "[REDACTED]",
        nested: [{ password: "[REDACTED]" }],
      },
    );
  });
});
