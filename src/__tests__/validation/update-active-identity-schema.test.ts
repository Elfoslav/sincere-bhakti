import { describe, it, expect } from "vitest";
import {
  updateActiveIdentitySchema,
} from "@/lib/validation";

describe("updateActiveIdentitySchema", () => {
  it("accepts channelId", () => {
    const result = updateActiveIdentitySchema.safeParse({ channelId: "channel-1" });
    expect(result.success).toBe(true);
  });

  it("rejects blank channelId", () => {
    const result = updateActiveIdentitySchema.safeParse({ channelId: "" });
    expect(result.success).toBe(false);
  });
});
