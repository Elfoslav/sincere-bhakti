import { describe, it, expect } from "vitest";
import { genId } from "@/lib/id";

describe("genId", () => {
  it("returns a string with timestamp prefix and random suffix", () => {
    const id = genId();
    expect(typeof id).toBe("string");
    const [ts, suffix] = id.split("-");
    expect(Number(ts)).toBeGreaterThan(1_700_000_000_000);
    expect(suffix).toMatch(/^[a-z0-9]{4}$/);
  });

  it("produces different values on successive calls", () => {
    const a = genId();
    const b = genId();
    expect(a).not.toBe(b);
  });
});
