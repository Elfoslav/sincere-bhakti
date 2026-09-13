import { describe, it, expect } from "vitest";
import { getImageAcceptString, ALLOWED_UPLOAD_CONTENT_TYPES } from "@/lib/validation";

describe("getImageAcceptString", () => {
  it("derives from the shared allowlist (image types only)", () => {
    const accept = getImageAcceptString();
    const images = ALLOWED_UPLOAD_CONTENT_TYPES.filter((t) => t.startsWith("image/"));
    expect(accept).toBe(images.join(","));
    expect(accept).not.toContain("video/");
  });
});
