import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const mockSend = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(() => Promise.resolve("https://r2.example.com/upload-url")),
}));

import { createUploadUrl, contentTypeToMediaType, processAndUpload, setS3Client } from "@/lib/services/upload";

describe("createUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setS3Client({ send: mockSend } as unknown as S3Client);
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev";
  });

  it("generates upload and public URLs", async () => {
    const result = await createUploadUrl("photo.jpg", "image/jpeg", "user-1");

    expect(result.uploadUrl).toBe("https://r2.example.com/upload-url");
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/posts\/user-1\/.+\.jpg$/);
    expect(result.key).toMatch(/^posts\/user-1\/.+\.jpg$/);
  });

  it("sanitizes filename", async () => {
    const result = await createUploadUrl("my cool photo!@#.jpg", "image/jpeg", "user-1");

    expect(result.key).toMatch(/^posts\/user-1\/[\w-]+-my_cool_photo___\.jpg$/);
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/posts\/user-1\/[\w-]+-my_cool_photo___\.jpg$/);
  });
});

describe("processAndUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setS3Client({ send: mockSend } as unknown as S3Client);
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev";
    mockSend.mockResolvedValue({});
  });

  it("resizes large images to within MAX_IMAGE_DIMENSION", async () => {
    const buffer = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer();

    const result = await processAndUpload(buffer, "large.jpg", "image/jpeg", "user-1");

    expect(result.width).toBe(2048);
    expect(result.height).toBe(1365);
    expect(result.mediaType).toBe("image");
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/posts\/user-1\/.+\.jpg$/);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("preserves small images without resizing", async () => {
    const buffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 128, b: 0 } },
    }).jpeg().toBuffer();

    const result = await processAndUpload(buffer, "small.jpg", "image/jpeg", "user-1");

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("passes through GIF images without processing", async () => {
    const buffer = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).jpeg().toBuffer();

    const result = await processAndUpload(buffer, "large.gif", "image/gif", "user-1");

    // GIF is bypassed — no resize, dimensions unknown
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("passes through videos without processing", async () => {
    const buffer = Buffer.from("fake-video-data");

    const result = await processAndUpload(buffer, "video.mp4", "video/mp4", "user-1");

    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.mediaType).toBe("video");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("extracts dimensions from already-small images", async () => {
    const buffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 0 } },
    }).jpeg().toBuffer();

    const result = await processAndUpload(buffer, "tiny.jpg", "image/jpeg", "user-1");

    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
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
