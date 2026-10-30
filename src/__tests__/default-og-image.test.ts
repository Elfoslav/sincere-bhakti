// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

describe("default Open Graph image", () => {
  it("serves an opaque 1200×630 JPEG under 600 KB matching its metadata", async () => {
    const buffer = await readFile(join(process.cwd(), "public", DEFAULT_OG_IMAGE.url));
    const metadata = await sharp(buffer).metadata();

    expect(DEFAULT_OG_IMAGE.type).toBe("image/jpeg");
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(DEFAULT_OG_IMAGE.width);
    expect(metadata.height).toBe(DEFAULT_OG_IMAGE.height);
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(metadata.hasAlpha).toBe(false);
    expect(buffer.byteLength).toBeLessThan(600 * 1024);
  });
});
