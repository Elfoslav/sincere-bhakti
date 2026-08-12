import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_IMAGE_INPUT_PIXELS } from "@/lib/validation";

// Mock sharp so we can assert every decode of user-supplied bytes carries the
// `limitInputPixels` cap (decompression-bomb defense) without allocating a real
// multi-hundred-MP image in the test.
const { sharpFactory } = vi.hoisted(() => ({
  sharpFactory: vi.fn((..._args: unknown[]) => ({
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed")),
  })),
}));

vi.mock("sharp", () => ({ default: sharpFactory }));

import { processImage } from "@/lib/services/upload";

describe("processImage sharp input limits", () => {
  beforeEach(() => {
    sharpFactory.mockClear();
  });

  it("passes limitInputPixels to every sharp() decode of user bytes", async () => {
    await processImage(Buffer.from("fake-jpeg"), "image/jpeg");

    expect(sharpFactory).toHaveBeenCalled();
    // Every invocation must carry the bomb guard as the options argument.
    for (const call of sharpFactory.mock.calls) {
      expect(call[1]).toEqual({ limitInputPixels: MAX_IMAGE_INPUT_PIXELS });
    }
  });

  it("uses a cap well below sharp's ~268MP default but above real photos", () => {
    expect(MAX_IMAGE_INPUT_PIXELS).toBeGreaterThan(20_000_000);
    expect(MAX_IMAGE_INPUT_PIXELS).toBeLessThan(268_402_689);
  });
});
