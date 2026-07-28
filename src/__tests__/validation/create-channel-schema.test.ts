import { describe, it, expect } from "vitest";
import {
  createChannelSchema,
} from "@/lib/validation";

describe("createChannelSchema", () => {
  it("accepts valid channel name", () => {
    const result = createChannelSchema.safeParse({ name: "My Devotees" });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 1 char", () => {
    expect(createChannelSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts name with exactly 1 char", () => {
    expect(createChannelSchema.safeParse({ name: "a" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createChannelSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(createChannelSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts name at max length", () => {
    expect(createChannelSchema.safeParse({ name: "a".repeat(50) }).success).toBe(true);
  });

  it("rejects name exceeding max length", () => {
    expect(createChannelSchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
  });

  it("accepts optional language field with any supported locale", () => {
    expect(createChannelSchema.safeParse({ name: "Channel", language: "en" }).success).toBe(true);
    expect(createChannelSchema.safeParse({ name: "Channel", language: "cs" }).success).toBe(true);
    expect(createChannelSchema.safeParse({ name: "Channel", language: "sk" }).success).toBe(true);
    expect(createChannelSchema.safeParse({ name: "Channel", language: undefined }).success).toBe(true);
    expect(createChannelSchema.safeParse({ name: "Channel" }).success).toBe(true);
  });
});
