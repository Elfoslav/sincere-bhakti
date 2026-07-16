import { describe, it, expect } from "vitest";
import { getApiErrorCode, isApiErrorCode } from "@/lib/api-error";

describe("api-error helpers", () => {
  it("extracts a string error code from an API body", () => {
    expect(getApiErrorCode({ error: "too_many_requests" })).toBe("too_many_requests");
  });

  it("returns an empty string for non-object or non-string errors", () => {
    expect(getApiErrorCode(null)).toBe("");
    expect(getApiErrorCode({ error: 123 })).toBe("");
  });

  it("matches an expected error code", () => {
    expect(isApiErrorCode({ error: "too_many_requests" }, "too_many_requests")).toBe(true);
    expect(isApiErrorCode({ error: "server_error" }, "too_many_requests")).toBe(false);
  });
});
