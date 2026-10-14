import { describe, it, expect } from "vitest";
import { createAlbumSchema } from "@/lib/validation";

const media = [{ url: "https://pub.r2.dev/gallery/a/x.jpg", type: "image" }];

describe("createAlbumSchema", () => {
  it("accepts a title with media", () => {
    const result = createAlbumSchema.safeParse({ title: "Festival", media });
    expect(result.success).toBe(true);
  });

  it("accepts a description-only album", () => {
    const result = createAlbumSchema.safeParse({ title: "Notes", description: "Some words" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty album (no description, no media)", () => {
    const result = createAlbumSchema.safeParse({ title: "Empty" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank title", () => {
    const result = createAlbumSchema.safeParse({ title: "   ", media });
    expect(result.success).toBe(false);
  });

  it("rejects a title over the max length", () => {
    const result = createAlbumSchema.safeParse({ title: "x".repeat(101), media });
    expect(result.success).toBe(false);
  });

  it("rejects more than 200 media items", () => {
    const result = createAlbumSchema.safeParse({
      title: "Big",
      media: Array.from({ length: 201 }, (_, i) => ({
        url: `https://pub.r2.dev/gallery/a/${i}.jpg`,
        type: "image",
      })),
    });
    expect(result.success).toBe(false);
  });

  it("trims the title", () => {
    const result = createAlbumSchema.safeParse({ title: "  Festival  ", media });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Festival");
  });
});
