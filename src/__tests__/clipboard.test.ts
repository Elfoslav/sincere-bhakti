import { describe, it, expect, vi, afterEach } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = document.execCommand;

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    // @ts-expect-error restoring a navigator without clipboard (non-secure context)
    delete navigator.clipboard;
  }
  document.execCommand = originalExecCommand;
  vi.restoreAllMocks();
});

describe("copyTextToClipboard", () => {
  it("uses the async Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyTextToClipboard("https://example.test/p/1")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.test/p/1");
  });

  it("falls back to execCommand when navigator.clipboard is undefined (non-secure context)", async () => {
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await expect(copyTextToClipboard("https://example.test/p/1")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when writeText rejects (permission denied)", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    setClipboard({ writeText });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await expect(copyTextToClipboard("https://example.test/p/1")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when the fallback copy fails", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);

    await expect(copyTextToClipboard("https://example.test/p/1")).resolves.toBe(false);
  });

  it("returns false instead of throwing when everything fails", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("execCommand failed");
    });

    await expect(copyTextToClipboard("https://example.test/p/1")).resolves.toBe(false);
  });

  it("cleans up the temporary textarea after the fallback", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(true);

    await copyTextToClipboard("https://example.test/p/1");
    expect(document.querySelectorAll("body > textarea").length).toBe(0);
  });
});
