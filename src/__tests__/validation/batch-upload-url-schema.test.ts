import { describe, it, expect } from "vitest";
import {
  batchUploadUrlSchema,
} from "@/lib/validation";

describe("batchUploadUrlSchema", () => {
  it("accepts selected channel identity", () => {
    const result = batchUploadUrlSchema.safeParse({
      postId: "11111111-1111-4111-8111-111111111111",
      channelId: "channel-1",
      files: [{ fileName: "photo.jpg", contentType: "image/jpeg", size: 1024 }],
    });

    expect(result.success).toBe(true);
  });

  it("accepts the gallery folder", () => {
    const result = batchUploadUrlSchema.safeParse({
      postId: "11111111-1111-4111-8111-111111111111",
      folder: "gallery",
      files: [{ fileName: "photo.jpg", contentType: "image/jpeg", size: 1024 }],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.folder).toBe("gallery");
  });

  it("accepts up to 50 files per batch (gallery-sized)", () => {
    const result = batchUploadUrlSchema.safeParse({
      postId: "11111111-1111-4111-8111-111111111111",
      folder: "gallery",
      files: Array.from({ length: 50 }, (_, i) => ({
        fileName: `photo-${i}.jpg`,
        contentType: "image/jpeg",
        size: 1024,
      })),
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than 50 files", () => {
    const result = batchUploadUrlSchema.safeParse({
      postId: "11111111-1111-4111-8111-111111111111",
      folder: "gallery",
      files: Array.from({ length: 51 }, (_, i) => ({
        fileName: `photo-${i}.jpg`,
        contentType: "image/jpeg",
        size: 1024,
      })),
    });

    expect(result.success).toBe(false);
  });
});
