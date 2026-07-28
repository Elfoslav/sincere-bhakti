import { describe, it, expect } from "vitest";
import {
  updateNameSchema,
} from "@/lib/validation";

describe("updateNameSchema", () => {
  it("accepts valid name", () => {
    const result = updateNameSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = updateNameSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = updateNameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});
