import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";

const mockSend = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(() => Promise.resolve("https://r2.example.com/upload-url")),
}));

import { createUploadUrl, contentTypeToMediaType, setS3Client } from "@/lib/services/upload";

describe("createUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setS3Client({ send: mockSend } as unknown as S3Client);
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev";
  });

  it("generates upload and public URLs", async () => {
    const result = await createUploadUrl("photo.jpg", "image/jpeg");

    expect(result.uploadUrl).toBe("https://r2.example.com/upload-url");
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/posts\/.+\.jpg$/);
    expect(result.key).toMatch(/^posts\/.+\.jpg$/);
  });

  it("sanitizes filename", async () => {
    const result = await createUploadUrl("my cool photo!@#.jpg", "image/jpeg");

    expect(result.key).toMatch(/^posts\/[\w-]+-my_cool_photo___\.jpg$/);
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/posts\/[\w-]+-my_cool_photo___\.jpg$/);
  });
});

describe("contentTypeToMediaType", () => {
  it("returns video for video/*", () => {
    expect(contentTypeToMediaType("video/mp4")).toBe("video");
    expect(contentTypeToMediaType("video/quicktime")).toBe("video");
  });

  it("returns image for image/*", () => {
    expect(contentTypeToMediaType("image/jpeg")).toBe("image");
    expect(contentTypeToMediaType("image/png")).toBe("image");
  });

  it("returns file for unknown types", () => {
    expect(contentTypeToMediaType("application/pdf")).toBe("file");
    expect(contentTypeToMediaType("text/plain")).toBe("file");
  });
});
