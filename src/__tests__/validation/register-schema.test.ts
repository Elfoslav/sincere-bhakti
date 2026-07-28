import { describe, it, expect } from "vitest";
import {
  registerSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      name: "Krishna Das",
      email: "kdas@example.com",
      password: "secret123",
      terms: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = registerSchema.safeParse({
      email: "kdas@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "k@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("lowercases email", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "KriShna@ExamplE.Com",
      password: "secret123",
      terms: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("krishna@example.com");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Krishna",
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 50 chars", () => {
    const result = registerSchema.safeParse({
      name: "A".repeat(51),
      email: "k@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });
});
