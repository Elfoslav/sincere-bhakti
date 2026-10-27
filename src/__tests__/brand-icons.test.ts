import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

const master = readFileSync("public/images/lotus.svg", "utf8");
const browser = readFileSync("src/app/icon.svg", "utf8");
const ico = readFileSync("src/app/favicon.ico");

describe("brand icon assets", () => {
  it("keeps favicon artwork in sync with the single font-free lotus master", () => {
    expect(master).not.toMatch(/<text|🪷|<image|<script/);
    expect(browser).not.toMatch(/<text|🪷|<image|<script/);
    for (const [, path] of master.matchAll(/ d="([^"]+)"/g)) expect(browser).toContain(`d="${path}"`);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(5);
  });

  it.each([16, 32, 48, 64, 256])("contains a decodable, non-empty %ipx ICO frame", async (size) => {
    const entries = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => 6 + i * 16);
    const entry = entries.find((offset) => (ico[offset] || 256) === size)!;
    expect(entry).toBeDefined();
    const start = ico.readUInt32LE(entry + 12);
    const frame = ico.subarray(start, start + ico.readUInt32LE(entry + 8));
    const metadata = await sharp(frame).metadata();
    expect(metadata.width).toBe(size); expect(metadata.height).toBe(size);
    const stats = await sharp(frame).stats();
    expect(stats.channels[0].max - stats.channels[0].min).toBeGreaterThan(50);
  });

  it("provides an opaque 180px Apple touch icon", async () => {
    const image = sharp("src/app/apple-icon.png");
    const metadata = await image.metadata();
    expect(metadata.width).toBe(180); expect(metadata.height).toBe(180);
    expect((await image.stats()).isOpaque).toBe(true);
  });
});
