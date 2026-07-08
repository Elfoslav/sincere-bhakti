import { describe, it, expect } from "vitest";
import { formatBytes } from "@/lib/format";

describe("formatBytes", () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1_024)).toBe("1 KB");
    expect(formatBytes(1_536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1_048_576)).toBe("1 MB");
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1_073_741_824)).toBe("1 GB");
  });

  it("rounds to one decimal place", () => {
    expect(formatBytes(3_145_728)).toBe("3 MB");
    expect(formatBytes(3_408_435)).toBe("3.3 MB");
  });

  it("handles unexpected negative input gracefully", () => {
    expect(formatBytes(-100)).toBe("NaN undefined");
  });
});
