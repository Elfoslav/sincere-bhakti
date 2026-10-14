import { describe, it, expect } from "vitest";
import { updateAlbumSchema } from "@/lib/validation";

describe("updateAlbumSchema", () => {
  it("accepts a title-only patch", () => {
    expect(updateAlbumSchema.safeParse({ title: "New name" }).success).toBe(true);
  });

  it("accepts a media replacement", () => {
    const result = updateAlbumSchema.safeParse({
      media: [{ url: "https://pub.r2.dev/gallery/a/x.jpg", type: "image" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects clearing both description and media", () => {
    const result = updateAlbumSchema.safeParse({ description: null, media: [] });
    expect(result.success).toBe(false);
  });

  it("accepts clearing media while keeping a description", () => {
    const result = updateAlbumSchema.safeParse({ description: "kept", media: [] });
    expect(result.success).toBe(true);
  });

  it("leaves untouched fields alone when patch is media-only", () => {
    const result = updateAlbumSchema.safeParse({
      media: [{ url: "https://pub.r2.dev/gallery/a/x.jpg", type: "image" }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeUndefined();
  });
});
