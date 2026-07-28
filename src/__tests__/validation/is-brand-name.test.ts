import { describe, it, expect } from "vitest";
import {
  isBrandName,
} from "@/lib/validation";

describe("isBrandName", () => {
  it("detects brand name with default brand", () => {
    expect(isBrandName("Sincere Bhakti")).toBe(true);
  });

  it("detects lowercase brand name", () => {
    expect(isBrandName("sincere bhakti")).toBe(true);
  });

  it("detects concatenated words", () => {
    expect(isBrandName("sincerebhakti")).toBe(true);
  });

  it("detects hyphenated words", () => {
    expect(isBrandName("sincere-bhakti")).toBe(true);
  });

  it("detects brand with prefix and suffix", () => {
    expect(isBrandName("1sincere bhakti whatever")).toBe(true);
  });

  it("detects brand with custom brand name", () => {
    expect(isBrandName("My Radha Name", "Radha")).toBe(true);
  });

  it("allows names containing only one word of the brand", () => {
    expect(isBrandName("sincere devotee")).toBe(false);
    expect(isBrandName("pure bhakti")).toBe(false);
  });

  it("allows unrelated names", () => {
    expect(isBrandName("Krishna Das")).toBe(false);
  });

  it("handles empty brand name gracefully", () => {
    expect(isBrandName("anything", "")).toBe(false);
  });
});
