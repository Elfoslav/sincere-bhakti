import { describe, it, expect } from "vitest";
import {
  getAcceptString,
  ALLOWED_UPLOAD_CONTENT_TYPES,
} from "@/lib/validation";

describe("getAcceptString", () => {
  it("includes every allowed content type", () => {
    const accept = getAcceptString();
    for (const ct of ALLOWED_UPLOAD_CONTENT_TYPES) {
      expect(accept).toContain(ct);
    }
    expect(accept.split(",")).toHaveLength(ALLOWED_UPLOAD_CONTENT_TYPES.length);
  });
});
