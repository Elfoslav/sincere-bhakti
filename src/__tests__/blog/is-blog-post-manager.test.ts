import { describe, it, expect } from "vitest";
import { isBlogPostManager } from "@/lib/blog";

const post = (ownerId: string, channelId: string) => ({
  channel: { id: channelId, ownerId },
});

describe("isBlogPostManager", () => {
  it("allows the channel owner", () => {
    expect(isBlogPostManager(post("user-1", "channel-1"), "user-1", [])).toBe(true);
  });

  it("allows a manageable channel id", () => {
    expect(isBlogPostManager(post("owner", "channel-1"), "user-1", ["channel-1"])).toBe(true);
  });

  it("denies strangers", () => {
    expect(isBlogPostManager(post("owner", "channel-1"), "user-1", ["other"])).toBe(false);
  });

  it("denies anonymous viewers with no manageable channels", () => {
    expect(isBlogPostManager(post("owner", "channel-1"), undefined, undefined)).toBe(false);
    expect(isBlogPostManager(post("owner", "channel-1"), undefined, [])).toBe(false);
  });
});
