import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { getImageDimensions, setDimensionTimeout } from "@/lib/client-media";

let origCreateObjectURL: typeof URL.createObjectURL;
let origRevokeObjectURL: typeof URL.revokeObjectURL;

beforeAll(() => {
  origCreateObjectURL = URL.createObjectURL;
  origRevokeObjectURL = URL.revokeObjectURL;
});

afterAll(() => {
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
});

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.useFakeTimers();
});

function createMockImage(opts: { load?: true; naturalWidth?: number; naturalHeight?: number } | { load?: false } = {}) {
  return class MockImage {
    naturalWidth = "load" in opts && opts.load ? opts.naturalWidth ?? 0 : 0;
    naturalHeight = "load" in opts && opts.load ? opts.naturalHeight ?? 0 : 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      // Use a microtask so the load callback beats the timeout
      // (the timeout was scheduled for DIMENSION_TIMEOUT_MS which is large)
      queueMicrotask(() => {
        if (opts.load === true) this.onload?.();
        else if (opts.load === false) this.onerror?.();
      });
    }
  } as unknown as typeof Image;
}

describe("getImageDimensions", () => {
  it("resolves null for non-image files", async () => {
    const file = new File(["data"], "vid.mp4", { type: "video/mp4" });
    await expect(getImageDimensions(file)).resolves.toBeNull();
  });

  it("resolves dimensions on successful image load", async () => {
    const origImage = globalThis.Image;
    globalThis.Image = createMockImage({ load: true, naturalWidth: 800, naturalHeight: 600 });
    try {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const result = await getImageDimensions(file);
      expect(result).toEqual({ width: 800, height: 600 });
    } finally {
      globalThis.Image = origImage;
    }
  });

  it("resolves null on image load error", async () => {
    const origImage = globalThis.Image;
    globalThis.Image = createMockImage({ load: false });
    try {
      const file = new File(["data"], "broken.jpg", { type: "image/jpeg" });
      const result = await getImageDimensions(file);
      expect(result).toBeNull();
    } finally {
      globalThis.Image = origImage;
    }
  });

  it("uses timeout to resolve null when image never loads", async () => {
    setDimensionTimeout(5_000);
    const origImage = globalThis.Image;
    globalThis.Image = createMockImage(); // never fires load/error
    try {
      const file = new File(["data"], "slow.jpg", { type: "image/jpeg" });
      const promise = getImageDimensions(file);
      vi.advanceTimersByTime(5_000);
      await expect(promise).resolves.toBeNull();
    } finally {
      globalThis.Image = origImage;
    }
  });

  it("calls revokeObjectURL on success", async () => {
    const origImage = globalThis.Image;
    globalThis.Image = createMockImage({ load: true, naturalWidth: 100, naturalHeight: 100 });
    try {
      const file = new File(["data"], "a.jpg", { type: "image/jpeg" });
      await getImageDimensions(file);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    } finally {
      globalThis.Image = origImage;
    }
  });

  it("calls revokeObjectURL on error", async () => {
    const origImage = globalThis.Image;
    globalThis.Image = createMockImage({ load: false });
    try {
      const file = new File(["data"], "bad.jpg", { type: "image/jpeg" });
      await getImageDimensions(file);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    } finally {
      globalThis.Image = origImage;
    }
  });
});
