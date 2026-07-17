import { describe, it, expect } from "vitest";
import { DEFAULT_MAX_CHANNELS_PER_USER, getMaxChannelsPerUser } from "@/lib/channel-limit";

describe("getMaxChannelsPerUser", () => {
  it("returns the default when the env var is missing", () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      delete process.env.MAX_CHANNELS_PER_USER;
      expect(getMaxChannelsPerUser()).toBe(DEFAULT_MAX_CHANNELS_PER_USER);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });

  it("parses a positive integer from the env var", () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "7";
      expect(getMaxChannelsPerUser()).toBe(7);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });

  it("falls back to the default for invalid values", () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "not-a-number";
      expect(getMaxChannelsPerUser()).toBe(DEFAULT_MAX_CHANNELS_PER_USER);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });

  it("rejects partially numeric values", () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "1abc";
      expect(getMaxChannelsPerUser()).toBe(DEFAULT_MAX_CHANNELS_PER_USER);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });

  it("allows zero", () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "0";
      expect(getMaxChannelsPerUser()).toBe(0);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });
});
