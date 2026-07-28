import { describe, it, expect } from "vitest";
import {
  batchUploadUrlSchema,
} from "@/lib/validation";

describe("batchUploadUrlSchema", () => {
  it("accepts selected channel identity", () => {
    const result = batchUploadUrlSchema.safeParse({
      postId: "post-123",
      channelId: "channel-1",
      files: [{ fileName: "photo.jpg", contentType: "image/jpeg", size: 1024 }],
    });

    expect(result.success).toBe(true);
  });
});
