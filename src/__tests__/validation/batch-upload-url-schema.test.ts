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
});
