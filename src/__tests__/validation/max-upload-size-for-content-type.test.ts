import { describe, it, expect } from "vitest";
import {
  maxUploadSizeForContentType,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/validation";

describe("maxUploadSizeForContentType", () => {
  it("returns the video limit for video/* types", () => {
    expect(maxUploadSizeForContentType("video/mp4")).toBe(MAX_VIDEO_SIZE_BYTES);
  });

  it("returns the image limit for image/* types", () => {
    expect(maxUploadSizeForContentType("image/png")).toBe(MAX_IMAGE_SIZE_BYTES);
  });

  it("falls back to the stricter image limit for other types", () => {
    expect(maxUploadSizeForContentType("application/octet-stream")).toBe(
      MAX_IMAGE_SIZE_BYTES,
    );
  });

  it("caps videos at 200 MB and images at 10 MB", () => {
    expect(MAX_VIDEO_SIZE_BYTES).toBe(200 * 1024 * 1024);
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
