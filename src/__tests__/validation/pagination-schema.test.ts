import { describe, it, expect } from "vitest";
import {
  paginationSchema,
} from "@/lib/validation";

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.scope).toBeUndefined();
    }
  });

  it("parses limit from string", () => {
    const result = paginationSchema.safeParse({ limit: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });

  it("rejects limit over 50", () => {
    const result = paginationSchema.safeParse({ limit: "100" });
    expect(result.success).toBe(false);
  });

  it("accepts public scope", () => {
    const result = paginationSchema.safeParse({ scope: "public" });
    expect(result.success).toBe(true);
  });

  it("accepts private scope", () => {
    const result = paginationSchema.safeParse({ scope: "private" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid scope", () => {
    const result = paginationSchema.safeParse({ scope: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts language filter", () => {
    const result = paginationSchema.safeParse({ language: "cs" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("cs");
    }
  });

  it("rejects invalid language filter", () => {
    const result = paginationSchema.safeParse({ language: "fr" });
    expect(result.success).toBe(false);
  });
});
